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
 * Exceptions to "the total row is always written":
 * - revenue_tmt / orders_completed rows exist only for days with at least one
 *   completed order (missing = 0); see refreshRevenue.
 * - visitors_week / visitors_month rows exist only for periods that were
 *   complete when counted (LATE_EVENTS_GRACE_MS after their last day), so a
 *   stored row is always the final count; see rollupPeriods.
 *
 * Unique counts (visitors_*) can't be summed across days; the metric queries
 * use raw events for exact counts where they still exist (see metrics/sql.ts).
 *
 * Every write is idempotent and runs as one transaction that first takes the
 * `analytics-rollup` advisory lock, and every statement reads its sources
 * itself (INSERT … SELECT), after the lock: two overlapping runs serialize,
 * and the later one always writes from data at least as new.
 *
 * Jobs (scripts/batch-runner/jobs/analytics-rollup*.ts):
 * - every 10 min: rollupDay(today) (and yesterday in the first hour); the
 *   first run after start-up also runs catchUp({ onlyMissingPeriods }).
 * - nightly: catchUp() (the last CATCH_UP_DAYS days, the weeks/months that
 *   ended in them, revenue for every day), then the funnel of the rest of
 *   the raw window (its last step depends on orders' current status).
 */
import { Prisma } from '@prisma/client';

import dbClient from '@/lib/dbClient';

import { breakdownsRollups } from './metrics/breakdowns';
import { ordersRollups } from './metrics/orders';
import { productsRollups } from './metrics/products';
import { revenueInsert, revenueRollups } from './metrics/revenue';
import { searchRollups } from './metrics/search';
import { eventsWhere, STORED, type DailyRollup } from './metrics/stored';
import { trafficRollups } from './metrics/traffic';
import {
  eachDay,
  isComplete,
  localDay,
  periodEnd,
  periodStarts,
  rawWindowStart,
  shiftDay,
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

/** Days before today that catchUp re-rolls (nightly, and once at start-up). */
export const CATCH_UP_DAYS = 7;

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

/** Runs `statements` in one transaction, after taking the rollup lock. */
async function locked(statements: readonly Prisma.Sql[]): Promise<void> {
  if (statements.length === 0) return;
  await dbClient.$transaction([
    lockStatement(),
    ...statements.map((statement) => dbClient.$executeRaw(statement)),
  ]);
}

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
  await locked([
    Prisma.sql`
      DELETE FROM "AnalyticsDaily"
      WHERE "day" = ${sqlDate(day)} AND "metric" IN (${Prisma.join(metrics)})`,
    ...rollups.flatMap((r) => r.build(day)),
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
 * Replaces the `revenue_tmt` and `orders_completed` rows of every day with
 * one grouped query over UserOrder, in one locked transaction. Days that no
 * longer have a completed order lose their rows. This is how an order
 * completed before the raw window, edited later, moved out of COMPLETED, or
 * completed again on a later day ends up counted once, on its current
 * completion day. One pass over the completed orders: cheap at this scale.
 */
export async function refreshRevenue(): Promise<void> {
  await locked([
    Prisma.sql`
      DELETE FROM "AnalyticsDaily"
      WHERE "metric" IN (${STORED.revenue}, ${STORED.ordersCompleted})`,
    revenueInsert(),
  ]);
}

/**
 * Recomputes the funnel rows (their last step depends on orders' current
 * status) of the days of `from`..`to` that are inside the raw window.
 */
export async function refreshFunnel(
  from: string,
  to: string,
  options: RollupOptions = {},
): Promise<void> {
  assertDay(from);
  assertDay(to);
  const funnel = DAILY_ROLLUPS.filter(
    (r) => r.reads.includes('orders') && r.reads.includes('events'),
  );
  // eslint-disable-next-line no-restricted-syntax
  for (const day of eachDay(from, to)) {
    if (hasRawEvents(day, options)) {
      // eslint-disable-next-line no-await-in-loop
      await writeDay(day, funnel);
    }
  }
}

/**
 * Recomputes everything that depends on orders' current state: the funnel
 * of the days of `from`..`to` inside the raw window, and revenue and
 * completed orders of every day (refreshRevenue).
 */
export async function refreshOrderOutcomes(
  from: string,
  to: string,
  options: RollupOptions = {},
): Promise<void> {
  await refreshFunnel(from, to, options);
  await refreshRevenue();
}

type Period = {
  metric: typeof STORED.visitorsWeek | typeof STORED.visitorsMonth;
  start: string;
  end: string;
};

/** The ISO weeks and months that overlap `from`..`to`. */
function periodsTouching(from: string, to: string): Period[] {
  return (
    [
      ['week', STORED.visitorsWeek],
      ['month', STORED.visitorsMonth],
    ] as const
  ).flatMap(([granularity, metric]) =>
    periodStarts(from, to, granularity).map((start) => ({
      metric,
      start,
      end: periodEnd(start, granularity),
    })),
  );
}

/**
 * Unique visitors of every ISO week (Monday start) and calendar month that
 * overlaps `from`..`to`, stored as `visitors_week` / `visitors_month` with
 * `day` = the period's first day:
 * - a complete period (now ≥ its end + LATE_EVENTS_GRACE_MS) is counted from
 *   raw events and stored, so a stored row is always a final count;
 * - a period still in progress has its row deleted (the dashboard counts it
 *   from raw events), so a row counted before the period ended, by older
 *   code or by hand, can't later pass for a final one;
 * - a period that starts before the raw window keeps whatever row it has
 *   (its raw events are partly gone), unless `ignoreRetention`.
 * `onlyMissing` skips complete periods that already have a row (the cheap
 * start-up catch-up; the nightly run recounts).
 */
export async function rollupPeriods(
  from: string,
  to: string,
  options: RollupOptions & { onlyMissing?: boolean } = {},
): Promise<void> {
  assertDay(from);
  assertDay(to);
  const now = options.now ?? new Date();
  const periods = periodsTouching(from, to);

  const inProgress = periods.filter((p) => !isComplete(p.end, now));
  let toCount = periods.filter(
    (p) => isComplete(p.end, now) && hasRawEvents(p.start, options),
  );
  if (options.onlyMissing && toCount.length > 0) {
    const existing = await dbClient.analyticsDaily.findMany({
      where: {
        OR: toCount.map((p) => ({
          metric: p.metric,
          day: new Date(`${p.start}T00:00:00Z`),
          dimension: '',
          dimensionValue: '',
        })),
      },
      select: { metric: true, day: true },
    });
    const have = new Set(
      existing.map((r) => `${r.metric}|${r.day.toISOString().slice(0, 10)}`),
    );
    toCount = toCount.filter((p) => !have.has(`${p.metric}|${p.start}`));
  }

  await locked([
    ...inProgress.map(
      (p) => Prisma.sql`
        DELETE FROM "AnalyticsDaily"
        WHERE "metric" = ${p.metric} AND "day" = ${sqlDate(p.start)}
          AND "dimension" = '' AND "dimensionValue" = ''`,
    ),
    ...toCount.map(
      (p) => Prisma.sql`
        INSERT INTO "AnalyticsDaily" ("day", "metric", "dimension", "dimensionValue", "value")
        SELECT ${sqlDate(p.start)}, ${p.metric}, '', '', count(DISTINCT "visitorId")::bigint
        FROM "AnalyticsEvent"
        WHERE ${eventsWhere(p.start, p.end)}
        ON CONFLICT ("metric", "day", "dimension", "dimensionValue")
        DO UPDATE SET "value" = EXCLUDED."value"`,
    ),
  ]);
}

/** rollupPeriods for the ISO week and the month that contain `day`. */
export function rollupPeriodUniques(
  day: string,
  options: RollupOptions = {},
): Promise<void> {
  return rollupPeriods(day, day, options);
}

/**
 * Heals whatever missed runs left behind: re-rolls every metric of the
 * CATCH_UP_DAYS days before today, recounts the weeks and months that touch
 * them or today (so a period whose closing nightly run was missed gets its
 * final row, and in-progress rows are cleared), and refreshes revenue for
 * every day. Returns the re-rolled days.
 */
export async function catchUp(
  options: RollupOptions & { onlyMissingPeriods?: boolean } = {},
): Promise<{ from: string; to: string }> {
  const now = options.now ?? new Date();
  const today = localDay(now);
  const from = shiftDay(today, -CATCH_UP_DAYS);
  const to = shiftDay(today, -1);
  await rollupRange(from, to, { now });
  await rollupPeriods(from, today, {
    now,
    onlyMissing: options.onlyMissingPeriods,
  });
  await refreshRevenue();
  return { from, to };
}
