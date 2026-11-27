import { Prisma } from '@prisma/client';

import dbClient from '@/lib/dbClient';

import { sqlDayRange, sqlLocalDay } from '../time';
import { SERIES_LABEL_KEYS } from './catalog';
import {
  memoize,
  round2,
  sumDailyByPeriod,
  sumDailyUntil,
  toPoints,
  type KpiRange,
  type QueryContext,
} from './sql';
import { STORED, TMT_MINOR_UNITS, type DailyRollup } from './stored';
import { kpi, type WidgetGroup } from './widget';

const COMPLETED_AT = Prisma.sql`"completedAt"`;

/**
 * Revenue from completed orders, read from UserOrder (not from events):
 * `status = 'COMPLETED'`, attributed to the Ashgabat day of `completedAt`.
 * Widgets: kpi_revenue, kpi_orders_completed, kpi_aov, revenue.
 *
 * `revenue_tmt` / `orders_completed` rows exist only for days with at least
 * one completed order (a missing day reads as 0). rollupDay writes one day's;
 * the nightly job replaces every day's at once (refreshRevenue in rollup.ts),
 * so an order completed long ago, edited, moved out of COMPLETED or completed
 * again on a later day is counted once, on the day it is completed now.
 */

/**
 * A `UserOrder.totalPrice` (a TMT amount string such as '1290' or '1305.50')
 * in hundredths of a manat. Parsed like orderService does (`parseFloat`, so
 * trailing junk is ignored); anything unparseable, infinite or negative
 * counts as 0. The rollups parse in SQL instead (completedOrdersSql; an
 * integration test checks the two agree).
 */
export function parseTmtMinor(totalPrice: string | null | undefined): number {
  const amount = parseFloat(totalPrice ?? '');
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * TMT_MINOR_UNITS);
}

/**
 * Completed orders as rows of (`day`: the Ashgabat day of `completedAt`,
 * `minor`: the total in 1/100 TMT), filtered by `where` on UserOrder.
 *
 * `minor` is parseTmtMinor in SQL: the leading decimal number of
 * `totalPrice` (after whitespace and an optional '+'; an exponent is
 * allowed), in hundredths, rounded half up. No number, a minus sign, an
 * exponent of 4+ digits (Infinity or 0 for parseFloat) or an absurd amount
 * (≥ 10^12 TMT) count as 0, so one bad row can't overflow the rollup.
 */
export function completedOrdersSql(where: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    SELECT n.day,
           CASE
             WHEN n.num IS NULL OR n.num ~ '[eE][+-]?[0-9]{4,}' THEN 0
             WHEN n.num::numeric <= 0 OR n.num::numeric >= 1e12 THEN 0
             ELSE round(n.num::numeric * ${Prisma.raw(String(TMT_MINOR_UNITS))})
           END AS minor
    FROM (
      SELECT ${sqlLocalDay(COMPLETED_AT)} AS day,
             substring("totalPrice" from '^[[:space:]]*[+]?((?:[0-9]+[.]?[0-9]*|[.][0-9]+)(?:[eE][+-]?[0-9]+)?)') AS num
      FROM "UserOrder"
      WHERE "status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND ${where}
    ) AS n`;
}

/**
 * INSERT … SELECT of the `revenue_tmt` and `orders_completed` rows of the
 * days `from`..`to` (every day when omitted). Reads UserOrder in the
 * statement itself, so it runs inside the caller's locked transaction.
 */
export function revenueInsert(range?: {
  from: string;
  to: string;
}): Prisma.Sql {
  const where = range
    ? sqlDayRange(COMPLETED_AT, range.from, range.to)
    : Prisma.sql`TRUE`;
  return Prisma.sql`
    INSERT INTO "AnalyticsDaily" ("day", "metric", "dimension", "dimensionValue", "value")
    SELECT o.day, x.metric, '', '', x.value
    FROM (
      SELECT c.day, sum(c.minor)::bigint AS revenue, count(*)::bigint AS orders
      FROM (${completedOrdersSql(where)}) AS c
      GROUP BY c.day
    ) AS o
    CROSS JOIN LATERAL (VALUES
      (${STORED.revenue}::text, o.revenue),
      (${STORED.ordersCompleted}::text, o.orders)
    ) AS x(metric, value)
    ON CONFLICT ("metric", "day", "dimension", "dimensionValue")
    DO UPDATE SET "value" = EXCLUDED."value"`;
}

export const revenueRollups: DailyRollup[] = [
  {
    metrics: [STORED.revenue, STORED.ordersCompleted],
    reads: ['orders'],
    build: (day) => [revenueInsert({ from: day, to: day })],
  },
];

/**
 * Revenue (in 1/100 TMT) and count of the orders completed on `day` before
 * `until`, straight from UserOrder (always available). Once per request.
 */
function completedOrdersUntil(
  ctx: QueryContext,
  day: string,
  until: Date,
): Promise<{ revenueMinor: number; orders: number }> {
  return memoize(ctx, ['completedOrdersUntil', day, until], async () => {
    const [row] = await dbClient.$queryRaw<
      { revenue: bigint | null; orders: bigint }[]
    >`
      SELECT sum(c.minor)::bigint AS revenue, count(*)::bigint AS orders
      FROM (${completedOrdersSql(sqlDayRange(COMPLETED_AT, day, day, until))}) AS c`;
    return {
      revenueMinor: Number(row?.revenue ?? 0),
      orders: Number(row?.orders ?? 0),
    };
  });
}

const revenueTmt = async (ctx: QueryContext, range: KpiRange) =>
  (await sumDailyUntil(
    STORED.revenue,
    range,
    async (day, until) =>
      (await completedOrdersUntil(ctx, day, until)).revenueMinor,
  )) / TMT_MINOR_UNITS;

const ordersCompleted = (ctx: QueryContext, range: KpiRange) =>
  sumDailyUntil(
    STORED.ordersCompleted,
    range,
    async (day, until) => (await completedOrdersUntil(ctx, day, until)).orders,
  );

export const revenueWidgets = {
  kpi_revenue: (p) => kpi(p, (range) => revenueTmt(p.ctx, range)),

  kpi_orders_completed: (p) => kpi(p, (range) => ordersCompleted(p.ctx, range)),

  kpi_aov: (p) =>
    kpi(p, async (range) => {
      const [revenue, orders] = await Promise.all([
        revenueTmt(p.ctx, range),
        ordersCompleted(p.ctx, range),
      ]);
      return orders > 0 ? round2(revenue / orders) : null;
    }),

  // Revenue only: the completed-order count is a different unit (it would
  // sit flat at 0 on a TMT axis) and has its own KPI.
  revenue: async ({ from, to, granularity }) => {
    const revenue = await sumDailyByPeriod(
      STORED.revenue,
      from,
      to,
      granularity,
    );
    const revenueTmtByPeriod = new Map(
      Array.from(revenue, ([period, minor]) => [
        period,
        minor / TMT_MINOR_UNITS,
      ]),
    );
    return {
      kind: 'timeseries',
      series: [
        {
          key: 'revenue',
          labelKey: SERIES_LABEL_KEYS.revenue,
          points: toPoints(revenueTmtByPeriod, from, to, granularity),
        },
      ],
    };
  },
} satisfies WidgetGroup;
