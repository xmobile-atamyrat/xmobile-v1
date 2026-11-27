import dbClient from '@/lib/dbClient';
import { fetchTelekomBalance } from '@/lib/telekom';

import type { AnalyticsQuery } from './adminQuery';
import { createQueryContext, queryWidget } from './metrics';
import { widgetMeta, type MetricId } from './metrics/catalog';
import type { AnalyticsResponse, AnalyticsWidgetResult } from './metrics/types';

/**
 * Server side of `GET /api/admin/analytics`: runs the widget queries, adds the
 * user count and Telekom balance, and caches whole responses briefly.
 */

const filepath = 'src/lib/analytics/adminApi.ts';

export const RESPONSE_CACHE_TTL_MS = 60_000;
export const RESPONSE_CACHE_MAX_ENTRIES = 100;
/** The balance doesn't depend on the query, so it's kept longer. */
export const TELEKOM_CACHE_TTL_MS = 5 * 60_000;
/** Telekom is an outside service; never let it hold the response up longer. */
export const TELEKOM_TIMEOUT_MS = 3_000;

type Entry<T> = { expiresAt: number; value: Promise<T> };

/**
 * A small TTL cache of promises, so identical requests that arrive together
 * share one computation. Bounded: the oldest entry goes when it's full.
 */
export class PromiseCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  private readonly ttlMs: number;

  private readonly maxEntries: number;

  private readonly now: () => number;

  constructor(ttlMs: number, maxEntries: number, now: () => number = Date.now) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
  }

  get size(): number {
    return this.entries.size;
  }

  /**
   * The cached value for `key`, or `load()`'s. A rejected load, or one that
   * `keep` turns down, is dropped so the next caller tries again.
   */
  getOrLoad(
    key: string,
    load: () => Promise<T>,
    keep: (value: T) => boolean = () => true,
  ): Promise<T> {
    const current = this.now();
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > current) return hit.value;
    if (hit) this.entries.delete(key);

    const value = load();
    const entry: Entry<T> = { expiresAt: current + this.ttlMs, value };
    this.entries.set(key, entry);
    this.evict(current);
    const forget = () => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
    };
    value.then((result) => {
      if (!keep(result)) forget();
    }, forget);
    return value;
  }

  clear(): void {
    this.entries.clear();
  }

  private evict(current: number): void {
    if (this.entries.size <= this.maxEntries) return;
    this.entries.forEach((entry, key) => {
      if (entry.expiresAt <= current) this.entries.delete(key);
    });
    // Map keeps insertion order, so the first keys are the oldest.
    const keys = this.entries.keys();
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(keys.next().value as string);
    }
  }
}

/** Cache key: the viewer tier plus the normalised query. */
export const analyticsCacheKey = (
  query: AnalyticsQuery,
  superuser: boolean,
): string =>
  [
    superuser ? 'superuser' : 'staff',
    query.widgets.join(','),
    query.from,
    query.to,
    query.granularity,
    query.limit,
    query.locale,
  ].join('|');

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const responseCache = new PromiseCache<AnalyticsResponse>(
  RESPONSE_CACHE_TTL_MS,
  RESPONSE_CACHE_MAX_ENTRIES,
);
const telekomCache = new PromiseCache<number | null>(TELEKOM_CACHE_TTL_MS, 1);

/** For tests. */
export function clearAnalyticsCaches(): void {
  responseCache.clear();
  telekomCache.clear();
}

async function loadTelekomBalance(): Promise<number | null> {
  try {
    return await telekomCache.getOrLoad(
      'balance',
      () =>
        withTimeout(
          fetchTelekomBalance().catch((error) => {
            console.error(filepath, 'telekom balance', error);
            return null;
          }),
          TELEKOM_TIMEOUT_MS,
          null,
        ),
      // A miss (no credentials, timeout, outage) is retried on the next load.
      (balance) => balance != null,
    );
  } catch {
    return null;
  }
}

async function loadUserCount(): Promise<number | null> {
  try {
    return await dbClient.user.count();
  } catch (error) {
    console.error(filepath, 'user count', error);
    return null;
  }
}

async function computeAnalytics(
  query: AnalyticsQuery,
): Promise<AnalyticsResponse> {
  const { widgets: ids, from, to, granularity, limit, locale } = query;
  const params = { from, to, granularity, limit, locale };

  // One context per request: widgets needing the same raw COUNT(DISTINCT)
  // scan (visitors for kpi_visitors and kpi_conversion) share it.
  const ctx = createQueryContext();
  const [settled, userCount, telekomBalance] = await Promise.all([
    Promise.allSettled(ids.map((id) => queryWidget(id, params, { ctx }))),
    loadUserCount(),
    loadTelekomBalance(),
  ]);

  const widgets = ids.map((id: MetricId, index): AnalyticsWidgetResult => {
    // Every id was validated against the catalog by parseAnalyticsQuery.
    const meta = widgetMeta(id)!;
    const outcome = settled[index];
    if (outcome.status === 'rejected') {
      console.error(filepath, `widget ${id} failed`, outcome.reason);
    }
    return {
      id,
      kind: meta.kind,
      unit: meta.unit,
      labelKey: meta.labelKey,
      data: outcome.status === 'fulfilled' ? outcome.value : null,
    };
  });

  return { from, to, granularity, widgets, userCount, telekomBalance };
}

/**
 * The dashboard response for a validated query. `query.widgets` must already
 * be limited to what the viewer may see (parseAnalyticsQuery does that).
 * Responses with a failed widget aren't cached, so a retry runs it again.
 */
export function getAnalytics(
  query: AnalyticsQuery,
  superuser: boolean,
): Promise<AnalyticsResponse> {
  return responseCache.getOrLoad(
    analyticsCacheKey(query, superuser),
    () => computeAnalytics(query),
    (response) =>
      response.userCount != null &&
      response.widgets.every((widget) => widget.data != null),
  );
}
