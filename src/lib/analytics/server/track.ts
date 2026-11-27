import { Prisma } from '@prisma/client';

import {
  EventProps,
  events,
  ServerEventName,
  splitEntity,
} from '@/lib/analytics/events';
import {
  AnalyticsEventRow,
  enqueueAnalyticsEvent,
  holdAnalyticsEvent,
  MAX_BUFFERED_EVENTS,
  trackPendingAnalytics,
} from '@/lib/analytics/server/buffer';
import {
  AnalyticsRequest,
  readIdentity,
  resolveLocale,
  userAgentOf,
  userIdFromRefreshCookie,
} from '@/lib/analytics/server/request';
import {
  sanitizeString,
  sanitizeValue,
  truncateUtf16,
} from '@/lib/analytics/server/sanitize';
import {
  AnalyticsUserStatus,
  cachedAnalyticsUser,
  lookupAnalyticsUser,
} from '@/lib/analytics/server/staff';
import { detectPlatform, isBot } from '@/lib/analytics/server/userAgent';

export interface TrackServerOptions {
  /** The logged-in user, when the handler knows it. */
  userId?: string | null;
}

interface BuildRowOptions extends TrackServerOptions {
  /** When the event happened; defaults to now. */
  occurredAt?: Date;
}

function jsonProps(
  props: Record<string, unknown> | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return props == null ? Prisma.DbNull : (props as Prisma.InputJsonValue);
}

/**
 * The row `trackServer()` would queue, or null when the event is skipped: a
 * bot, no valid `xa_vid` cookie, or props the catalog rejects. Strings in the
 * props are sanitized (NUL, lone surrogates) so one bad value can't fail the
 * batched insert it lands in.
 */
export function buildServerEventRow<N extends ServerEventName>(
  req: AnalyticsRequest,
  name: N,
  props: EventProps<N>,
  opts: BuildRowOptions = {},
): AnalyticsEventRow | null {
  const userAgent = userAgentOf(req);
  if (isBot(userAgent)) return null;
  const { visitorId, sessionId } = readIdentity(req);
  // No cookie means the tracker never ran (a script, or cookies blocked).
  // Without a visitor the event can't join a funnel, so it is dropped.
  if (visitorId == null) return null;

  const parsed = events[name].safeParse(sanitizeValue(props));
  if (!parsed.success) {
    console.warn(
      `[analytics] dropped invalid ${name} props:`,
      parsed.error.issues.map((issue) => issue.message).join('; '),
    );
    return null;
  }
  const split = splitEntity(name, parsed.data as Record<string, unknown>);
  return {
    occurredAt: opts.occurredAt ?? new Date(),
    name,
    visitorId,
    sessionId,
    userId: opts.userId == null ? null : sanitizeString(opts.userId),
    entityId: split.entityId,
    platform: detectPlatform(userAgent),
    locale: resolveLocale(req),
    props: jsonProps(split.props),
  };
}

/**
 * Applies what analytics knows about the row's user: null for a staff user's
 * event (dropped), the row without its userId for a deleted account.
 */
function applyUserStatus(
  row: AnalyticsEventRow,
  status: AnalyticsUserStatus,
): AnalyticsEventRow | null {
  if (status.staff) return null;
  return status.deleted ? { ...row, userId: null } : row;
}

/**
 * Queues `row` unless it belongs to a staff user (no analytics for ADMIN /
 * SUPERUSER); a soft-deleted user's row is queued without the userId. With
 * a cached lookup this is synchronous; otherwise the lookup runs in the
 * background and `flushAnalyticsBuffer()` waits for it.
 */
function enqueueForUser(row: AnalyticsEventRow, what: string): void {
  const { userId } = row;
  if (userId == null) {
    enqueueAnalyticsEvent(row);
    return;
  }
  const cached = cachedAnalyticsUser(userId);
  if (cached !== undefined) {
    const kept = applyUserStatus(row, cached);
    if (kept != null) enqueueAnalyticsEvent(kept);
    return;
  }
  const work = lookupAnalyticsUser(userId)
    .then((status) => {
      const kept = applyUserStatus(row, status);
      if (kept != null) enqueueAnalyticsEvent(kept);
    })
    .catch((error) => {
      console.warn(`[analytics] ${what} failed:`, error);
    });
  trackPendingAnalytics(work);
}

/**
 * Records a server-side event (`order_placed`, `cart_add`, `search`, …).
 * Fire-and-forget: it queues the row in memory and returns. It never throws
 * and never waits on the database (a user lookup for an unknown `userId`
 * runs in the background), so it can't slow down or break the handler
 * calling it. Events of staff users are dropped, and a soft-deleted user's
 * are recorded without the userId. Call it after the write it describes has
 * succeeded.
 */
export function trackServer<N extends ServerEventName>(
  req: AnalyticsRequest,
  name: N,
  props: EventProps<N>,
  opts?: TrackServerOptions,
): void {
  try {
    const row = buildServerEventRow(req, name, props, opts);
    if (row != null) enqueueForUser(row, `trackServer(${name})`);
  } catch (error) {
    console.warn(`[analytics] trackServer(${name}) failed:`, error);
  }
}

/** Search terms are stored trimmed, lowercased, single-spaced, ≤100 chars. */
export const MAX_SEARCH_QUERY_LENGTH = 100;

export function normalizeSearchQuery(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return truncateUtf16(
    sanitizeString(raw).trim().toLowerCase().replace(/\s+/g, ' '),
    MAX_SEARCH_QUERY_LENGTH,
  ).trim();
}

/**
 * Search-as-you-type fires a request per debounced keystroke. A visitor's
 * search is held this long and replaced by their next one, so only the term
 * they stopped on is counted.
 */
export const SEARCH_SETTLE_MS = 3000;

/**
 * A visitor repeating the term they just searched (the listing refetching
 * page 1 for a new sort or filter, a reload, back/forward) isn't a new search.
 */
export const SEARCH_REPEAT_WINDOW_MS = 30 * 60 * 1000;

const globalForSearch = globalThis as typeof globalThis & {
  analyticsLastSearch?: Map<string, { q: string; at: number }>;
  analyticsSearchSeq?: number;
};

function lastSearches(): Map<string, { q: string; at: number }> {
  if (globalForSearch.analyticsLastSearch == null) {
    globalForSearch.analyticsLastSearch = new Map();
  }
  return globalForSearch.analyticsLastSearch;
}

/** True when this visitor's last recorded search was `q`, within the window. */
function isRepeatSearch(visitorId: string, q: string, at: number): boolean {
  const previous = lastSearches().get(visitorId);
  return (
    previous != null &&
    previous.q === q &&
    at - previous.at < SEARCH_REPEAT_WINDOW_MS
  );
}

/** Remembers the search that was actually recorded for this visitor. */
function rememberSearch(visitorId: string, q: string, at: number): void {
  const last = lastSearches();
  // Re-inserted so the Map stays oldest-first and eviction takes the front.
  last.delete(visitorId);
  last.set(visitorId, { q, at });
  while (last.size > MAX_BUFFERED_EVENTS) {
    last.delete(last.keys().next().value as string);
  }
}

/** Forgets recent searches. Tests only. */
export function resetSearchTracking(): void {
  globalForSearch.analyticsLastSearch = undefined;
}

export interface TrackSearchOptions extends TrackServerOptions {
  /**
   * The number of products matching the keyword alone (not the category,
   * brand, price or stock filters of the listing, so a zero means "we don't
   * have it" rather than "not in this filter"). A number when the caller
   * already has it; a function when it costs a query, which then runs only
   * for the search a visitor settled on, off the request's critical path.
   */
  results: number | (() => Promise<number>);
}

/**
 * The parts of the request a held search reads when it is released. The
 * request object itself isn't kept for the settle time.
 */
function snapshotRequest(req: AnalyticsRequest): AnalyticsRequest {
  return {
    headers: { ...req.headers },
    cookies: req.cookies == null ? undefined : { ...req.cookies },
  };
}

/**
 * Records a storefront search. Call it for the first page of results only, so
 * infinite scroll doesn't count the same search again. When `userId` is left
 * undefined it is read from the refresh-token cookie (the product list isn't
 * behind `withAuth`). Staff users' searches are dropped. Fire-and-forget like
 * `trackServer()`.
 *
 * Search-as-you-type sends a request per keystroke, and those can finish out
 * of order. So only the intent is held, ordered by when this was called: a
 * later call replaces it, and the count query, user lookup and row are made
 * once, when the visitor has stopped typing for SEARCH_SETTLE_MS.
 */
export function trackSearch(
  req: AnalyticsRequest,
  rawQuery: unknown,
  { results, userId }: TrackSearchOptions,
): void {
  try {
    const q = normalizeSearchQuery(rawQuery);
    if (q === '') return;
    // Cheap checks first, so bots and cookieless requests never hold
    // anything.
    if (isBot(userAgentOf(req))) return;
    const { visitorId } = readIdentity(req);
    if (visitorId == null) return;

    const at = Date.now();
    globalForSearch.analyticsSearchSeq =
      (globalForSearch.analyticsSearchSeq ?? 0) + 1;
    const seq = globalForSearch.analyticsSearchSeq;
    const snapshot = snapshotRequest(req);

    const build = async (): Promise<AnalyticsEventRow | null> => {
      // A sort or filter change refetches page 1 with the same term.
      if (isRepeatSearch(visitorId, q, at)) return null;
      const [total, resolvedUserId] = await Promise.all([
        typeof results === 'function' ? results() : results,
        userId !== undefined ? userId : userIdFromRefreshCookie(snapshot),
      ]);
      let rowUserId = resolvedUserId;
      if (resolvedUserId != null) {
        // No analytics for staff, even when they search without a bearer.
        const status = await lookupAnalyticsUser(resolvedUserId);
        if (status.staff) return null;
        if (status.deleted) rowUserId = null;
      }
      const row = buildServerEventRow(
        snapshot,
        'search',
        { q, results: total },
        { userId: rowUserId, occurredAt: new Date(at) },
      );
      if (row != null) rememberSearch(visitorId, q, at);
      return row;
    };
    holdAnalyticsEvent(
      `search:${visitorId}`,
      () =>
        build().catch((error) => {
          console.warn('[analytics] trackSearch failed:', error);
          return null;
        }),
      SEARCH_SETTLE_MS,
      seq,
    );
  } catch (error) {
    console.warn('[analytics] trackSearch failed:', error);
  }
}
