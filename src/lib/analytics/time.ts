import { Prisma } from '@prisma/client';

import { dayRangeUtc, localDay, shiftDay } from '@/lib/adminActivityQueries';

import { RAW_RETENTION_DAYS } from './constants';
import type { Granularity } from './metrics/types';

/**
 * Day and period math for analytics. Days are Asia/Ashgabat calendar days as
 * 'YYYY-MM-DD' strings. Turkmenistan is UTC+05:00 all year (no DST), which
 * the admin activity helpers reused here already rely on.
 *
 * `AnalyticsEvent.occurredAt` and `UserOrder.completedAt` are UTC
 * `timestamp(3)` columns without a time zone, so an Ashgabat day D is the
 * half-open UTC range [D-1 19:00, D 19:00).
 */

export { localDay, shiftDay };

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How long after an Ashgabat midnight events of the day before may still be
 * arriving (beacons flushed on the next page load, the 5s server buffer). A
 * day or period counts as complete once this has passed after its end.
 */
export const LATE_EVENTS_GRACE_MS = 60 * 60 * 1000;

const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);

/** The UTC instant an Ashgabat day starts at. */
export function dayStartUtc(day: string): Date {
  return dayRangeUtc(day).gte as Date;
}

/** Ashgabat days `from`..`to` inclusive as a half-open UTC range. */
export function dayBoundsUtc(
  from: string,
  to: string,
): { start: Date; end: Date } {
  const range = dayRangeUtc(from, to);
  return { start: range.gte as Date, end: range.lt as Date };
}

/** Whether every event of the days up to `lastDay` should be stored at `now`. */
export function isComplete(lastDay: string, now: Date): boolean {
  return (
    now.getTime() >=
    dayStartUtc(shiftDay(lastDay, 1)).getTime() + LATE_EVENTS_GRACE_MS
  );
}

/** Number of days in `from`..`to`, inclusive. */
export function daysInRange(from: string, to: string): number {
  return Math.round((dayMs(to) - dayMs(from)) / MS_PER_DAY) + 1;
}

/** Every day of `from`..`to`, inclusive. Empty when `from > to`. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = shiftDay(day, 1)) days.push(day);
  return days;
}

/** The equally long range that ends the day before `from`. */
export function previousRange(
  from: string,
  to: string,
): { from: string; to: string } {
  const length = daysInRange(from, to);
  return { from: shiftDay(from, -length), to: shiftDay(from, -1) };
}

/** Monday of the ISO week containing `day`. */
export function isoWeekStart(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return shiftDay(day, -((weekday + 6) % 7));
}

/** First day of the calendar month containing `day`. */
export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/** Start of the day/week/month containing `day`. */
export function periodStart(day: string, granularity: Granularity): string {
  if (granularity === 'week') return isoWeekStart(day);
  if (granularity === 'month') return monthStart(day);
  return day;
}

/** Last day (inclusive) of the period starting at `start`. */
export function periodEnd(start: string, granularity: Granularity): string {
  if (granularity === 'week') return shiftDay(start, 6);
  if (granularity === 'month') {
    const date = new Date(`${start}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + 1, 0);
    return date.toISOString().slice(0, 10);
  }
  return start;
}

/** Start days of every period that overlaps `from`..`to`, in order. */
export function periodStarts(
  from: string,
  to: string,
  granularity: Granularity,
): string[] {
  const starts: string[] = [];
  for (
    let start = periodStart(from, granularity);
    start <= to;
    start = shiftDay(periodEnd(start, granularity), 1)
  ) {
    starts.push(start);
  }
  return starts;
}

/**
 * The first day whose raw events are certainly all still stored. Retention
 * deletes rows older than `now - RAW_RETENTION_DAYS`, so the day that cut-off
 * falls in may be partly gone; the day after it is complete.
 */
export function rawWindowStart(now: Date = new Date()): string {
  return shiftDay(localDay(now), -(RAW_RETENTION_DAYS - 1));
}

/**
 * A UTC instant as a `timestamp` SQL literal parameter. Passing a string and
 * casting keeps the comparison independent of the session's TimeZone setting
 * (the columns are `timestamp` without a zone, holding UTC).
 */
export function sqlTimestamp(date: Date): Prisma.Sql {
  const text = date.toISOString().replace('T', ' ').replace('Z', '');
  return Prisma.sql`${text}::timestamp`;
}

/**
 * The Ashgabat day of a UTC `timestamp` column, as a `date`. Plain interval
 * arithmetic on a zone-less timestamp, so the session TimeZone doesn't matter
 * (UTC+05:00 all year, see above).
 */
export function sqlLocalDay(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`(${column} + interval '5 hours')::date`;
}

/** An Ashgabat day as a `date` SQL parameter. */
export function sqlDate(day: string): Prisma.Sql {
  return Prisma.sql`${day}::date`;
}

/**
 * `"col" >= start AND "col" < end` for Ashgabat days `from`..`to`. `until`
 * moves the end earlier (it never extends the range): the last day then only
 * counts up to that instant.
 */
export function sqlDayRange(
  column: Prisma.Sql,
  from: string,
  to: string,
  until?: Date,
): Prisma.Sql {
  const { start, end } = dayBoundsUtc(from, to);
  const stop = until && until < end ? until : end;
  return Prisma.sql`${column} >= ${sqlTimestamp(start)} AND ${column} < ${sqlTimestamp(stop)}`;
}

/** Converts a `date` column value read back from Postgres to 'YYYY-MM-DD'. */
export function dayFromDb(value: Date | string): string {
  return typeof value === 'string'
    ? value.slice(0, 10)
    : value.toISOString().slice(0, 10);
}
