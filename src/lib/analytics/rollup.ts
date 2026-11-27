/**
 * Daily rollups: raw `AnalyticsEvent` rows (and `UserOrder` for revenue) into
 * `AnalyticsDaily`, which is small and kept forever. Run by the batch runner
 * (scripts/batch-runner/jobs/analytics-rollup*.ts).
 *
 * `day` is an Asia/Ashgabat calendar day (UTC+05:00, no DST): day D covers
 * UTC [D-1 19:00, D 19:00). Week/month rows use `day` = the period's first day
 * (ISO week: Monday; month: the 1st).
 *
 * Stored metrics (`metric` / `dimension` = `dimensionValue`: `value`). A ''
 * dimension is the total row, which is always written (0 when empty).
 * Grouped rows are only written for values that occur.
 *
 * | metric               | dimension → dimensionValue        | value                                   |
 * | -------------------- | --------------------------------- | --------------------------------------- |
 * | pageviews            | '' ; platform → WEB/APP ;         | page_view events                        |
 * |                      | locale → ru/en/tk/tr/ch ;         |                                         |
 * |                      | device → mobile/tablet/desktop/   |                                         |
 * |                      |          unknown                  |                                         |
 * | visitors             | '' ; platform → WEB/APP           | distinct visitorId, any event, that day |
 * | visitors_week        | '' (day = Monday)                 | distinct visitorId over the ISO week    |
 * | visitors_month       | '' (day = 1st)                    | distinct visitorId over the month       |
 * | sessions             | ''                                | distinct non-null sessionId, any event  |
 * | product_views        | product → productId               | product_view events                     |
 * | category_views       | category → categoryId             | category_view events                    |
 * | cart_adds            | product → productId               | cart_add events (not quantities)        |
 * | searches             | query → normalised query          | search events (empty queries skipped)   |
 * | zero_result_searches | query → normalised query          | search events with results = 0          |
 * | referrers            | host → referrer host              | page_view events with that referrer     |
 * | orders_placed        | ''                                | distinct orderId of order_placed events |
 * | funnel               | step → product_view / cart_add /  | visitors per step, same-day journeys    |
 * |                      |   order_placed / order_completed  | (definition in metrics/orders.ts)       |
 * | revenue_tmt          | ''                                | sum of totalPrice of orders COMPLETED   |
 * |                      |                                   | that day (by completedAt), in 1/100 TMT |
 * | orders_completed     | ''                                | count of those orders                   |
 *
 * Normalised search query: trimmed, inner whitespace collapsed, lower-cased.
 * Referrer host: trimmed, lower-cased, leading 'www.' dropped.
 *
 * Unique counts (visitors_*) can't be summed across days; the metric queries
 * use raw events for exact counts where they still exist (see metrics/sql.ts).
 *
 * Every rollup is idempotent: rollupDay deletes the day's rows for the metrics
 * it writes and inserts fresh ones in one transaction, under an advisory lock
 * so two runs of the batch runner can't interleave.
 */
import { Prisma } from '@prisma/client';

import dbClient from '@/lib/dbClient';

import { breakdownsRollups } from './metrics/breakdowns';
import { ordersRollups } from './metrics/orders';
import { productsRollups } from './metrics/products';
import { revenueRollups } from './metrics/revenue';
import { searchRollups } from './metrics/search';
import { rawDistinct } from './metrics/sql';
import { STORED, type DailyRollup } from './metrics/stored';
import { trafficRollups } from './metrics/traffic';
import {
  eachDay,
  isoWeekStart,
  monthStart,
  periodEnd,
  rawWindowStart,
  sqlDate,
} from './time';

export const DAILY_ROLLUPS: readonly DailyRollup[] = [
  ...trafficRollups,
  ...ordersRollups,
  ...revenueRollups,
  ...productsRollups,
  ...searchRollups,
  ...breakdownsRollups,
];

export interface RollupOptions {
  /** The clock; decides which days still have all their raw events. */
  now?: Date;
  /**
   * Recompute event-based metrics even for days older than the raw window
   * (for seeding/backfills where those raw events do exist).
   */
  ignoreRetention?: boolean;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDay(day: string): void {
  if (
    !DAY_RE.test(day) ||
    Number.isNaN(Date.parse(`${day}T00:00:00Z`)) ||
    new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day
  ) {
    throw new Error(`Invalid analytics day: ${day}`);
  }
}

const lockStatement = () =>
  dbClient.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('analytics-rollup'))`;

/** Whether the day's raw events can be trusted to be all there. */
const hasRawEvents = (day: string, options: RollupOptions) =>
  options.ignoreRetention === true ||
  day >= rawWindowStart(options.now ?? new Date());

/** Replaces the day's rows of `rollups`' metrics in one transaction. */
async function writeDay(
  day: string,
  rollups: readonly DailyRollup[],
): Promise<void> {
  if (rollups.length === 0) return;
  const metrics = Array.from(new Set(rollups.flatMap((r) => r.metrics)));
  const inserts = (await Promise.all(rollups.map((r) => r.build(day)))).flat();
  await dbClient.$transaction([
    lockStatement(),
    dbClient.$executeRaw`
      DELETE FROM "AnalyticsDaily"
      WHERE "day" = ${sqlDate(day)} AND "metric" IN (${Prisma.join(metrics)})`,
    ...inserts.map((statement) => dbClient.$executeRaw(statement)),
  ]);
}

/**
 * Recomputes every stored daily metric for an Ashgabat day, atomically
 * replacing that day's rows. Idempotent. For a day older than the raw window
 * only the UserOrder-based metrics (revenue_tmt, orders_completed) are
 * recomputed, so pruned raw data can't overwrite its rollups with zeros.
 */
export async function rollupDay(
  day: string,
  options: RollupOptions = {},
): Promise<void> {
  assertDay(day);
  const rollups = hasRawEvents(day, options)
    ? DAILY_ROLLUPS
    : DAILY_ROLLUPS.filter((r) => !r.reads.includes('events'));
  await writeDay(day, rollups);
}

/** rollupDay for every day of `from`..`to`, inclusive, one day at a time. */
export async function rollupRange(
  from: string,
  to: string,
  options: RollupOptions = {},
): Promise<void> {
  assertDay(from);
  assertDay(to);
  // Sequential on purpose: one day's transaction at a time on the small VM.
  // eslint-disable-next-line no-restricted-syntax
  for (const day of eachDay(from, to)) {
    // eslint-disable-next-line no-await-in-loop
    await rollupDay(day, options);
  }
}

/**
 * Recomputes only the metrics that depend on orders' current state (revenue,
 * completed orders, and the funnel's last step) for `from`..`to`. An order
 * completed, edited or moved out of COMPLETED after its day was rolled up is
 * picked up this way.
 */
export async function refreshOrderOutcomes(
  from: string,
  to: string,
  options: RollupOptions = {},
): Promise<void> {
  assertDay(from);
  assertDay(to);
  const withOrders = DAILY_ROLLUPS.filter((r) => r.reads.includes('orders'));
  // eslint-disable-next-line no-restricted-syntax
  for (const day of eachDay(from, to)) {
    const rollups = hasRawEvents(day, options)
      ? withOrders
      : withOrders.filter((r) => !r.reads.includes('events'));
    // eslint-disable-next-line no-await-in-loop
    await writeDay(day, rollups);
  }
}

/**
 * Unique visitors of the ISO week (Monday start) and the calendar month that
 * contain `day`, stored as `visitors_week` / `visitors_month` with `day` = the
 * period's first day. Counts every raw event of the period stored so far. A
 * period that starts before the raw window is skipped (its raw events are
 * partly gone), keeping whatever row was computed while they existed.
 */
export async function rollupPeriodUniques(
  day: string,
  options: RollupOptions = {},
): Promise<void> {
  assertDay(day);
  const periods = [
    { metric: STORED.visitorsWeek, start: isoWeekStart(day), unit: 'week' },
    { metric: STORED.visitorsMonth, start: monthStart(day), unit: 'month' },
  ] as const;

  const rows = await Promise.all(
    periods
      .filter((p) => hasRawEvents(p.start, options))
      .map(async (p) => ({
        ...p,
        value: await rawDistinct(
          'visitorId',
          p.start,
          periodEnd(p.start, p.unit),
        ),
      })),
  );
  if (rows.length === 0) return;

  await dbClient.$transaction([
    lockStatement(),
    ...rows.map(
      (row) => dbClient.$executeRaw`
        INSERT INTO "AnalyticsDaily" ("day", "metric", "dimension", "dimensionValue", "value")
        VALUES (${sqlDate(row.start)}, ${row.metric}, '', '', ${BigInt(row.value)})
        ON CONFLICT ("metric", "day", "dimension", "dimensionValue")
        DO UPDATE SET "value" = EXCLUDED."value"`,
    ),
  ]);
}
