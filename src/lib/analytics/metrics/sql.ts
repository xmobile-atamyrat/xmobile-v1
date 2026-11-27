import { Prisma } from '@prisma/client';

import dbClient from '@/lib/dbClient';

import type { EventName } from '../events';
import {
  dayFromDb,
  eachDay,
  localDay,
  periodEnd,
  periodStarts,
  shiftDay,
  sqlDate,
} from '../time';
import { eventsWhere, STORED, type StoredMetric } from './stored';
import type {
  Granularity,
  MetricQueryParams,
  TimeseriesPoint,
  TopNRow,
} from './types';

/**
 * Read helpers shared by the widget files. Everything reads `AnalyticsDaily`
 * through its primary key (metric, day, …) unless a widget needs a
 * `COUNT(DISTINCT)` that daily rows can't give; those read raw events through
 * the `occurredAt` / `(name, occurredAt)` indexes, and only for days inside the
 * raw retention window.
 */

/**
 * Per-request context: the clock, the first day raw events are complete, and
 * a memo of the raw-event scans already run. One dashboard load asks for the
 * same `COUNT(DISTINCT)` from several widgets (kpi_visitors and
 * kpi_conversion both count the visitors of both ranges); sharing one context
 * across the request's widgets runs each scan once.
 */
export interface QueryContext {
  now: Date;
  today: string;
  rawFrom: string;
  memo: Map<string, Promise<unknown>>;
}

export type WidgetQueryParams = MetricQueryParams & { ctx: QueryContext };

/**
 * A KPI range. With `until`, the last day only counts up to that instant: the
 * KPIs of a range ending today count today so far, and the previous range's
 * last day up to the same time of day.
 */
export interface KpiRange {
  from: string;
  to: string;
  until?: Date;
}

/** A value and whether it is exact (false: an upper bound). */
export interface Measured {
  value: number;
  exact: boolean;
}

/** Runs `load` once per context and key; later calls share its promise. */
export function memoize<T>(
  ctx: QueryContext,
  key: readonly unknown[],
  load: () => Promise<T>,
): Promise<T> {
  const k = JSON.stringify(key);
  const hit = ctx.memo.get(k) as Promise<T> | undefined;
  if (hit) return hit;
  const promise = load();
  ctx.memo.set(k, promise);
  return promise;
}

const toNumber = (value: bigint | number | string | null | undefined) =>
  value == null ? 0 : Number(value);

const dimensionFilter = (dimension: string, dimensionValue?: string) =>
  dimensionValue === undefined
    ? Prisma.sql`"dimension" = ${dimension}`
    : Prisma.sql`"dimension" = ${dimension} AND "dimensionValue" = ${dimensionValue}`;

/** Sum of a stored series over `from`..`to` ('' dimension = the total row). */
export async function sumDaily(
  metric: StoredMetric,
  from: string,
  to: string,
  dimension = '',
  dimensionValue = '',
): Promise<number> {
  const [row] = await dbClient.$queryRaw<{ total: bigint | null }[]>`
    SELECT sum("value")::bigint AS total FROM "AnalyticsDaily"
    WHERE "metric" = ${metric}
      AND "day" BETWEEN ${sqlDate(from)} AND ${sqlDate(to)}
      AND ${dimensionFilter(dimension, dimensionValue)}`;
  return toNumber(row?.total);
}

/** Per-value sums of one dimension of a stored series, largest first. */
export async function sumDailyBy(
  metric: StoredMetric,
  dimension: string,
  from: string,
  to: string,
  limit?: number,
): Promise<{ key: string; value: number }[]> {
  const rows = await dbClient.$queryRaw<{ key: string; total: bigint }[]>`
    SELECT "dimensionValue" AS key, sum("value")::bigint AS total
    FROM "AnalyticsDaily"
    WHERE "metric" = ${metric}
      AND "day" BETWEEN ${sqlDate(from)} AND ${sqlDate(to)}
      AND "dimension" = ${dimension}
    GROUP BY "dimensionValue"
    HAVING sum("value") > 0
    ORDER BY total DESC, key ASC
    ${limit === undefined ? Prisma.empty : Prisma.sql`LIMIT ${limit}`}`;
  return rows.map((r) => ({ key: r.key, value: toNumber(r.total) }));
}

/** Sums of a stored series per day/week/month period within `from`..`to`. */
export async function sumDailyByPeriod(
  metric: StoredMetric,
  from: string,
  to: string,
  granularity: Granularity,
  dimension = '',
  dimensionValue = '',
): Promise<Map<string, number>> {
  const rows = await dbClient.$queryRaw<
    { period: Date | string; total: bigint }[]
  >`
    SELECT date_trunc(${granularity}, "day"::timestamp)::date AS period,
           sum("value")::bigint AS total
    FROM "AnalyticsDaily"
    WHERE "metric" = ${metric}
      AND "day" BETWEEN ${sqlDate(from)} AND ${sqlDate(to)}
      AND ${dimensionFilter(dimension, dimensionValue)}
    GROUP BY 1`;
  return new Map(rows.map((r) => [dayFromDb(r.period), toNumber(r.total)]));
}

/** Stored rows of a period series (`visitors_week` / `visitors_month`). */
export async function periodRows(
  metric: StoredMetric,
  starts: readonly string[],
): Promise<Map<string, number>> {
  if (starts.length === 0) return new Map();
  const rows = await dbClient.$queryRaw<
    { day: Date | string; value: bigint }[]
  >`
    SELECT "day", "value" FROM "AnalyticsDaily"
    WHERE "metric" = ${metric}
      AND "day" IN (${Prisma.join(starts.map(sqlDate))})
      AND "dimension" = '' AND "dimensionValue" = ''`;
  return new Map(rows.map((r) => [dayFromDb(r.day), toNumber(r.value)]));
}

/**
 * Exact `COUNT(DISTINCT column)` of raw events over `from`..`to` (the last
 * day up to `until`), once per request.
 */
export function rawDistinct(
  ctx: QueryContext,
  column: 'visitorId' | 'sessionId',
  from: string,
  to: string,
  { names, until }: { names?: readonly EventName[]; until?: Date } = {},
): Promise<number> {
  return memoize(
    ctx,
    ['rawDistinct', column, from, to, names ?? null, until ?? null],
    async () => {
      const [row] = await dbClient.$queryRaw<{ total: bigint }[]>`
        SELECT count(DISTINCT ${Prisma.raw(`"${column}"`)})::bigint AS total
        FROM "AnalyticsEvent"
        WHERE ${eventsWhere(from, to, names, until)}`;
      return toNumber(row?.total);
    },
  );
}

/**
 * Raw `name` events of one day before `until`: all of them, or the distinct
 * `entityId`s (orders placed). Once per request.
 */
export function rawEventCount(
  ctx: QueryContext,
  name: EventName,
  day: string,
  until: Date,
  { distinctEntity = false }: { distinctEntity?: boolean } = {},
): Promise<number> {
  return memoize(
    ctx,
    ['rawEventCount', name, day, until, distinctEntity],
    async () => {
      const [row] = await dbClient.$queryRaw<{ total: bigint }[]>`
        SELECT ${
          distinctEntity
            ? Prisma.sql`count(DISTINCT "entityId")`
            : Prisma.sql`count(*)`
        }::bigint AS total
        FROM "AnalyticsEvent"
        WHERE ${eventsWhere(day, day, [name], until)}`;
      return toNumber(row?.total);
    },
  );
}

/** Exact distinct visitors per platform over `from`..`to`. */
export async function rawVisitorsByPlatform(
  from: string,
  to: string,
): Promise<{ key: string; value: number }[]> {
  const rows = await dbClient.$queryRaw<{ key: string; total: bigint }[]>`
    SELECT "platform"::text AS key, count(DISTINCT "visitorId")::bigint AS total
    FROM "AnalyticsEvent"
    WHERE ${eventsWhere(from, to)}
    GROUP BY 1
    ORDER BY total DESC, key ASC`;
  return rows.map((r) => ({ key: r.key, value: toNumber(r.total) }));
}

/**
 * Whether a stored week/month uniques row can be used as the period's value.
 * rollupPeriodUniques only stores a period once it is complete (computed at
 * least LATE_EVENTS_GRACE_MS after its last day), and deletes the row of a
 * period still in progress, so a row exists only for a period that was over
 * when it was counted. This also refuses a row for a period that hasn't
 * ended yet, should one exist (written by hand or by older code).
 */
export const isFinalPeriod = (
  start: string,
  granularity: Granularity,
  today: string,
): boolean => periodEnd(start, granularity) < today;

/** Clips a period to the requested range. */
export function clipPeriod(
  start: string,
  granularity: Granularity,
  from: string,
  to: string,
): { from: string; to: string } {
  const end = periodEnd(start, granularity);
  return { from: start < from ? from : start, to: end > to ? to : end };
}

/** One zero-filled point per period overlapping `from`..`to`. */
export function toPoints(
  values: Map<string, number>,
  from: string,
  to: string,
  granularity: Granularity,
): TimeseriesPoint[] {
  return periodStarts(from, to, granularity).map((period) => ({
    period,
    value: values.get(period) ?? 0,
  }));
}

/** Stored uniques of a range older than the raw window. */
export interface StoredUniques {
  /** Daily `visitors` totals by day. */
  daily: Map<string, number>;
  /** Final `visitors_week` / `visitors_month` rows by period start. */
  week: Map<string, number>;
  month: Map<string, number>;
}

/** Loads the stored uniques that bound visitors over `from`..`to`. */
export function loadStoredUniques(
  ctx: QueryContext,
  from: string,
  to: string,
): Promise<StoredUniques> {
  return memoize(ctx, ['storedUniques', from, to], async () => {
    const finalRows = async (
      granularity: 'week' | 'month',
      metric: StoredMetric,
    ) => {
      const starts = periodStarts(from, to, granularity).filter((s) =>
        isFinalPeriod(s, granularity, ctx.today),
      );
      return periodRows(metric, starts);
    };
    const [daily, week, month] = await Promise.all([
      sumDailyByPeriod(STORED.visitors, from, to, 'day'),
      finalRows('week', STORED.visitorsWeek),
      finalRows('month', STORED.visitorsMonth),
    ]);
    return { daily, week, month };
  });
}

/**
 * The tightest upper bound the stored rows give for unique visitors over
 * `from`..`to`: per week (and, separately, per month) overlapping the range,
 * the smaller of the period's final row (if any) and the sum of daily uniques
 * of the days of the period inside the range; the smaller of the week and
 * month totals. Each term is ≥ the true count of its days, so the result is
 * too, and it is never more than the plain sum of daily uniques.
 */
export function visitorsUpperBound(
  from: string,
  to: string,
  stored: StoredUniques,
): number {
  const dailySum = (a: string, b: string) =>
    eachDay(a, b).reduce((sum, day) => sum + (stored.daily.get(day) ?? 0), 0);
  const viaPeriods = (
    granularity: 'week' | 'month',
    rows: Map<string, number>,
  ) =>
    periodStarts(from, to, granularity).reduce((sum, start) => {
      const clip = clipPeriod(start, granularity, from, to);
      const days = dailySum(clip.from, clip.to);
      const row = rows.get(start);
      return sum + (row === undefined ? days : Math.min(days, row));
    }, 0);
  return Math.min(
    dailySum(from, to),
    viaPeriods('week', stored.week),
    viaPeriods('month', stored.month),
  );
}

/** The last day before the raw window, or `to` if that is earlier. */
export const storedOnlyTo = (to: string, ctx: QueryContext): string =>
  to < ctx.rawFrom ? to : shiftDay(ctx.rawFrom, -1);

/**
 * Unique visitors over `from`..`to` (the last day up to `until`). Exact from
 * raw events when the whole range is inside the raw window. Otherwise the
 * range is split at the raw window's first day: the days inside it are
 * counted exactly from raw events, the days before it are bounded by
 * visitorsUpperBound, and the two are added (a visitor seen in both parts
 * counts twice), which is an upper bound. `until` only applies when the last
 * day is inside the raw window; older last days count in full.
 *
 * `preload` widens the stored rows loaded for the older part (one load for
 * all the periods of a chart instead of one per period); it doesn't change
 * the result.
 */
export function uniqueVisitors(
  { from, to, until }: KpiRange,
  ctx: QueryContext,
  preload?: { from: string; to: string },
): Promise<Measured> {
  return memoize(ctx, ['uniqueVisitors', from, to, until ?? null], async () => {
    if (from >= ctx.rawFrom) {
      const value = await rawDistinct(ctx, 'visitorId', from, to, { until });
      return { value, exact: true };
    }
    const oldTo = storedOnlyTo(to, ctx);
    const [old, recent] = await Promise.all([
      loadStoredUniques(ctx, preload?.from ?? from, preload?.to ?? oldTo).then(
        (stored) => visitorsUpperBound(from, oldTo, stored),
      ),
      to >= ctx.rawFrom
        ? rawDistinct(ctx, 'visitorId', ctx.rawFrom, to, { until })
        : 0,
    ]);
    return { value: old + recent, exact: false };
  });
}

/**
 * Sessions over `from`..`to` (the last day up to `until`): exact in the raw
 * window; a range reaching past it is split like uniqueVisitors, with the
 * older days' daily session counts summed (an upper bound: a session that
 * spans midnight counts on both days).
 */
export async function sessionCount(
  { from, to, until }: KpiRange,
  ctx: QueryContext,
): Promise<Measured> {
  if (from >= ctx.rawFrom) {
    const value = await rawDistinct(ctx, 'sessionId', from, to, { until });
    return { value, exact: true };
  }
  const oldTo = storedOnlyTo(to, ctx);
  const [old, recent] = await Promise.all([
    sumDaily(STORED.sessions, from, oldTo),
    to >= ctx.rawFrom
      ? rawDistinct(ctx, 'sessionId', ctx.rawFrom, to, { until })
      : 0,
  ]);
  return { value: old + recent, exact: false };
}

/**
 * Sum of a stored series over a KPI range. With `until`, the last day is
 * counted by `lastDay(day, until)` instead of its stored row, and the days
 * before it from the stored rows. Callers pass `lastDay` only when its source
 * still has that day (raw events: inside the raw window).
 */
export async function sumDailyUntil(
  metric: StoredMetric,
  { from, to, until }: KpiRange,
  lastDay?: (day: string, cut: Date) => Promise<number>,
): Promise<number> {
  if (!until || !lastDay) return sumDaily(metric, from, to);
  const [head, tail] = await Promise.all([
    sumDaily(metric, from, shiftDay(to, -1)),
    lastDay(to, until),
  ]);
  return head + tail;
}

/**
 * sumDailyUntil for a series counted from raw `name` events. The last day
 * counts up to `until` when it is inside the raw window; an older last day
 * counts in full (one partial day in a range reaching 90+ days back is
 * negligible).
 */
export function eventSumUntil(
  ctx: QueryContext,
  metric: StoredMetric,
  range: KpiRange,
  name: EventName,
  options: { distinctEntity?: boolean } = {},
): Promise<number> {
  return sumDailyUntil(
    metric,
    range,
    range.to >= ctx.rawFrom
      ? (day, until) => rawEventCount(ctx, name, day, until, options)
      : undefined,
  );
}

export const contextFor = (now: Date, rawFrom: string): QueryContext => ({
  now,
  today: localDay(now),
  rawFrom,
  memo: new Map(),
});

/** Rounds to 2 decimals (money, percentages). */
export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** TopN rows without enrichment: `label` is the raw key. */
export const plainRows = (rows: { key: string; value: number }[]): TopNRow[] =>
  rows.map((r) => ({ key: r.key, label: r.key, value: r.value }));
