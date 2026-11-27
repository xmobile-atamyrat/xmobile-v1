import { Prisma } from '@prisma/client';

import type { EventName } from '../events';
import { sqlDate, sqlDayRange } from '../time';

/**
 * Names of the series stored in `AnalyticsDaily.metric`, with the dimensions
 * each one is broken down by. rollup.ts documents values and units. Several
 * widgets read the same stored series (e.g. `pageviews` feeds kpi_pageviews,
 * traffic, by_locale and by_device), so these are not widget ids.
 */
export const STORED = {
  pageviews: 'pageviews',
  visitors: 'visitors',
  visitorsWeek: 'visitors_week',
  visitorsMonth: 'visitors_month',
  sessions: 'sessions',
  productViews: 'product_views',
  categoryViews: 'category_views',
  cartAdds: 'cart_adds',
  searches: 'searches',
  zeroResultSearches: 'zero_result_searches',
  referrers: 'referrers',
  ordersPlaced: 'orders_placed',
  funnel: 'funnel',
  revenue: 'revenue_tmt',
  ordersCompleted: 'orders_completed',
} as const;

export type StoredMetric = (typeof STORED)[keyof typeof STORED];

export const DIM = {
  total: '',
  platform: 'platform',
  locale: 'locale',
  device: 'device',
  product: 'product',
  category: 'category',
  query: 'query',
  host: 'host',
  step: 'step',
} as const;

/** `dimensionValue` of `pageviews`/`device` rows when the event had no device. */
export const UNKNOWN_DEVICE = 'unknown';

/** Funnel steps in order: `dimensionValue` of the `funnel`/`step` rows. */
export const FUNNEL_STEPS = [
  'product_view',
  'cart_add',
  'order_placed',
  'order_completed',
] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

/** Revenue is stored in hundredths of a manat so `value` can stay a BigInt. */
export const TMT_MINOR_UNITS = 100;

/**
 * One daily rollup. `build(day)` returns the INSERT … SELECT statements that
 * write the day's rows for `metrics`; rollupDay deletes those metrics' rows
 * for the day and runs the statements in one transaction, after taking the
 * rollup advisory lock. `build` is synchronous on purpose: every read happens
 * inside that transaction, so an older, slower run can't overwrite a newer
 * one with data it read before the lock. `reads` says which source data the
 * rows come from, so days whose raw events were pruned can still refresh the
 * order-based ones without overwriting the rest with zeros.
 */
export interface DailyRollup {
  metrics: readonly StoredMetric[];
  reads: readonly ('events' | 'orders')[];
  build: (day: string) => Prisma.Sql[];
}

/**
 * `INSERT … SELECT` of a query that yields `dimension`, `dimension_value` and
 * `value` columns into `metric`'s rows for `day`.
 */
export function insertDaily(
  day: string,
  metric: StoredMetric,
  select: Prisma.Sql,
): Prisma.Sql {
  return Prisma.sql`
    INSERT INTO "AnalyticsDaily" ("day", "metric", "dimension", "dimensionValue", "value")
    SELECT ${sqlDate(day)}, ${metric}, s.dimension, s.dimension_value, s.value
    FROM (${select}) AS s
    ON CONFLICT ("metric", "day", "dimension", "dimensionValue")
    DO UPDATE SET "value" = EXCLUDED."value"`;
}

/**
 * WHERE clause for raw events of Ashgabat days `from`..`to` (and names).
 * With `until`, the last day only counts events before that instant.
 */
export function eventsWhere(
  from: string,
  to: string,
  names?: readonly EventName[],
  until?: Date,
): Prisma.Sql {
  const range = sqlDayRange(Prisma.sql`"occurredAt"`, from, to, until);
  if (!names || names.length === 0) return range;
  return names.length === 1
    ? Prisma.sql`"name" = ${names[0]} AND ${range}`
    : Prisma.sql`"name" IN (${Prisma.join(names)}) AND ${range}`;
}

/** Search query as stored: trimmed, inner whitespace collapsed, lower-cased. */
export const NORMALISED_QUERY_SQL = Prisma.sql`lower(regexp_replace(btrim("props"->>'q'), '\\s+', ' ', 'g'))`;

/** Referrer host as stored: trimmed, lower-cased, without a leading `www.`. */
export const NORMALISED_REFERRER_SQL = Prisma.sql`regexp_replace(lower(btrim("props"->>'referrer')), '^www\\.', '')`;
