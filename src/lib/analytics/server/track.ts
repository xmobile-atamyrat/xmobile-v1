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
import { cachedIsStaffUser, isStaffUser } from '@/lib/analytics/server/staff';
import { detectPlatform, isBot } from '@/lib/analytics/server/userAgent';

export interface TrackServerOptions {
  /** The logged-in user, when the handler knows it. */
  userId?: string | null;
}

function jsonProps(
  props: Record<string, unknown> | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return props == null ? Prisma.DbNull : (props as Prisma.InputJsonValue);
}

/**
 * The row `trackServer()` would queue, or null when the event is skipped: a
 * bot, no valid `xa_vid` cookie, or props the catalog rejects.
 */
export function buildServerEventRow<N extends ServerEventName>(
  req: AnalyticsRequest,
  name: N,
  props: EventProps<N>,
  opts: TrackServerOptions = {},
): AnalyticsEventRow | null {
  const userAgent = userAgentOf(req);
  if (isBot(userAgent)) return null;
  const { visitorId, sessionId } = readIdentity(req);
  // No cookie means the tracker never ran (a script, or cookies blocked).
  // Without a visitor the event can't join a funnel, so it is dropped.
  if (visitorId == null) return null;

  const parsed = events[name].safeParse(props);
  if (!parsed.success) {
    console.warn(
      `[analytics] dropped invalid ${name} props:`,
      parsed.error.issues.map((issue) => issue.message).join('; '),
    );
    return null;
  }
  const split = splitEntity(name, parsed.data as Record<string, unknown>);
  return {
    occurredAt: new Date(),
    name,
    visitorId,
    sessionId,
    userId: opts.userId ?? null,
    entityId: split.entityId,
    platform: detectPlatform(userAgent),
    locale: resolveLocale(req),
    props: jsonProps(split.props),
  };
}

/**
 * Queues `row` unless it belongs to a staff user (no analytics for ADMIN /
 * SUPERUSER). With a cached grade this is synchronous; otherwise the lookup
 * runs in the background and `flushAnalyticsBuffer()` waits for it.
 */
function enqueueUnlessStaff(row: AnalyticsEventRow, what: string): void {
  const { userId } = row;
  if (userId == null) {
    enqueueAnalyticsEvent(row);
    return;
  }
  const cached = cachedIsStaffUser(userId);
  if (cached !== undefined) {
    if (!cached) enqueueAnalyticsEvent(row);
    return;
  }
  const work = isStaffUser(userId)
    .then((staff) => {
      if (!staff) enqueueAnalyticsEvent(row);
    })
    .catch((error) => {
      console.warn(`[analytics] ${what} failed:`, error);
    });
  trackPendingAnalytics(work);
}

/**
 * Records a server-side event (`order_placed`, `cart_add`, `search`, …).
 * Fire-and-forget: it queues the row in memory and returns. It never throws
 * and never waits on the database (a staff check for an unknown `userId`
 * runs in the background), so it can't slow down or break the handler
 * calling it. Events of staff users are dropped. Call it after the write it
 * describes has succeeded.
 */
export function trackServer<N extends ServerEventName>(
  req: AnalyticsRequest,
  name: N,
  props: EventProps<N>,
  opts?: TrackServerOptions,
): void {
  try {
    const row = buildServerEventRow(req, name, props, opts);
    if (row != null) enqueueUnlessStaff(row, `trackServer(${name})`);
  } catch (error) {
    console.warn(`[analytics] trackServer(${name}) failed:`, error);
  }
}

/** Search terms are stored trimmed, lowercased, single-spaced, ≤100 chars. */
export const MAX_SEARCH_QUERY_LENGTH = 100;

export function normalizeSearchQuery(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_SEARCH_QUERY_LENGTH)
    .trim();
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
};

/** True when this visitor searched exactly `q` within the repeat window. */
function isRepeatSearch(visitorId: string, q: string, now: number): boolean {
  if (globalForSearch.analyticsLastSearch == null) {
    globalForSearch.analyticsLastSearch = new Map();
  }
  const last = globalForSearch.analyticsLastSearch;
  const previous = last.get(visitorId);
  if (
    previous != null &&
    previous.q === q &&
    now - previous.at < SEARCH_REPEAT_WINDOW_MS
  ) {
    return true;
  }
  // Re-inserted so the Map stays oldest-first and eviction takes the front.
  last.delete(visitorId);
  last.set(visitorId, { q, at: now });
  while (last.size > MAX_BUFFERED_EVENTS) {
    last.delete(last.keys().next().value as string);
  }
  return false;
}

/** Forgets recent searches. Tests only. */
export function resetSearchTracking(): void {
  globalForSearch.analyticsLastSearch = undefined;
}

export interface TrackSearchOptions extends TrackServerOptions {
  /**
   * The total number of matches. A number when the caller already has it; a
   * function when it costs a query, so it only runs for a visitor that's
   * actually tracked, and off the request's critical path.
   */
  results: number | (() => Promise<number>);
}

/**
 * Records a storefront search. Call it for the first page of results only, so
 * infinite scroll doesn't count the same search again. When `userId` is left
 * undefined it is read from the refresh-token cookie (the product list isn't
 * behind `withAuth`). Staff users' searches are dropped. Fire-and-forget like
 * `trackServer()`.
 */
export function trackSearch(
  req: AnalyticsRequest,
  rawQuery: unknown,
  { results, userId }: TrackSearchOptions,
): void {
  try {
    const q = normalizeSearchQuery(rawQuery);
    if (q === '') return;
    // Cheap checks first, so bots and cookieless requests never pay for the
    // count query or the token check.
    if (isBot(userAgentOf(req))) return;
    const { visitorId } = readIdentity(req);
    if (visitorId == null) return;
    if (isRepeatSearch(visitorId, q, Date.now())) return;

    const work = Promise.all([
      typeof results === 'function' ? results() : results,
      Promise.resolve(
        userId !== undefined ? userId : userIdFromRefreshCookie(req),
      ).then(async (resolved) => ({
        userId: resolved,
        staff: resolved != null && (await isStaffUser(resolved)),
      })),
    ])
      .then(([total, { userId: resolvedUserId, staff }]) => {
        // No analytics for staff, even when they search without a bearer.
        if (staff) return;
        const row = buildServerEventRow(
          req,
          'search',
          { q, results: total },
          { userId: resolvedUserId },
        );
        if (row != null) {
          holdAnalyticsEvent(`search:${visitorId}`, row, SEARCH_SETTLE_MS);
        }
      })
      .catch((error) => {
        console.warn('[analytics] trackSearch failed:', error);
      });
    trackPendingAnalytics(work);
  } catch (error) {
    console.warn('[analytics] trackSearch failed:', error);
  }
}
