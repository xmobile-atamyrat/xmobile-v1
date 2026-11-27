import { Prisma } from '@prisma/client';

import dbClient from '@/lib/dbClient';

import type { EventName } from '../events';
import {
  dayFromDb,
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

/** Per-request context: the clock, and the first day raw events are complete. */
export interface QueryContext {
  now: Date;
  today: string;
  rawFrom: string;
}

export type WidgetQueryParams = MetricQueryParams & { ctx: QueryContext };

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

/** Exact `COUNT(DISTINCT column)` of raw events over `from`..`to`. */
export async function rawDistinct(
  column: 'visitorId' | 'sessionId',
  from: string,
  to: string,
  names?: readonly EventName[],
): Promise<number> {
  const [row] = await dbClient.$queryRaw<{ total: bigint }[]>`
    SELECT count(DISTINCT ${Prisma.raw(`"${column}"`)})::bigint AS total
    FROM "AnalyticsEvent"
    WHERE ${eventsWhere(from, to, names)}`;
  return toNumber(row?.total);
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
 * Whether a stored week/month uniques row is final: the nightly job computes
 * the period containing yesterday, so a period that ended before yesterday
 * was last computed after it was over.
 */
export const isFinalPeriod = (
  start: string,
  granularity: Granularity,
  today: string,
): boolean => periodEnd(start, granularity) < shiftDay(today, -1);

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

/**
 * Upper bound for unique visitors over a range that reaches past the raw
 * window: the smallest of (a) the sum of daily uniques and (b)/(c) the sum of
 * the stored week / month uniques overlapping the range. Each is ≥ the true
 * count; (b)/(c) are only used when every overlapping period has a final row.
 */
export async function approxVisitors(
  from: string,
  to: string,
  today: string,
): Promise<number> {
  const candidates = await Promise.all([
    sumDaily(STORED.visitors, from, to),
    ...(
      [
        ['week', STORED.visitorsWeek],
        ['month', STORED.visitorsMonth],
      ] as const
    ).map(async ([granularity, metric]) => {
      const starts = periodStarts(from, to, granularity);
      if (starts.some((s) => !isFinalPeriod(s, granularity, today))) {
        return null;
      }
      const rows = await periodRows(metric, starts);
      if (rows.size !== starts.length) return null;
      return Array.from(rows.values()).reduce((a, b) => a + b, 0);
    }),
  ]);
  return Math.min(
    ...candidates.filter((c): c is number => c !== null && c !== undefined),
  );
}

/**
 * Unique visitors over `from`..`to`: exact from raw events when the whole
 * range is inside the raw window, otherwise `approxVisitors`.
 */
export function uniqueVisitors(
  from: string,
  to: string,
  ctx: QueryContext,
): Promise<number> {
  return from >= ctx.rawFrom
    ? rawDistinct('visitorId', from, to)
    : approxVisitors(from, to, ctx.today);
}

/** Sessions over `from`..`to`: exact in the raw window, else daily sums. */
export function sessionCount(
  from: string,
  to: string,
  ctx: QueryContext,
): Promise<number> {
  return from >= ctx.rawFrom
    ? rawDistinct('sessionId', from, to)
    : sumDaily(STORED.sessions, from, to);
}

export const contextFor = (now: Date, rawFrom: string): QueryContext => ({
  now,
  today: localDay(now),
  rawFrom,
});

/** Rounds to 2 decimals (money, percentages). */
export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** TopN rows without enrichment: `label` is the raw key. */
export const plainRows = (rows: { key: string; value: number }[]): TopNRow[] =>
  rows.map((r) => ({ key: r.key, label: r.key, value: r.value }));
