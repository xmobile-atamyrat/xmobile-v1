import { Prisma } from '@prisma/client';

import dbClient from '@/lib/dbClient';

import { dayBoundsUtc, sqlDate } from '../time';
import { SERIES_LABEL_KEYS } from './catalog';
import { round2, sumDaily, sumDailyByPeriod, toPoints } from './sql';
import { STORED, TMT_MINOR_UNITS, type DailyRollup } from './stored';
import { kpi, type WidgetGroup } from './widget';

/**
 * Revenue from completed orders, read from UserOrder (not from events):
 * `status = 'COMPLETED'`, attributed to the Ashgabat day of `completedAt`.
 * Widgets: kpi_revenue, kpi_orders_completed, kpi_aov, revenue.
 */

/**
 * A `UserOrder.totalPrice` (a TMT amount string such as '1290' or '1305.50')
 * in hundredths of a manat. Parsed like orderService does (`parseFloat`, so
 * trailing junk is ignored); anything unparseable, infinite or negative
 * counts as 0.
 */
export function parseTmtMinor(totalPrice: string | null | undefined): number {
  const amount = parseFloat(totalPrice ?? '');
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * TMT_MINOR_UNITS);
}

/** Revenue (in 1/100 TMT) and count of the orders completed on `day`. */
export async function completedOrdersOn(
  day: string,
): Promise<{ revenueMinor: number; orders: number }> {
  const { start, end } = dayBoundsUtc(day, day);
  const orders = await dbClient.userOrder.findMany({
    where: { status: 'COMPLETED', completedAt: { gte: start, lt: end } },
    select: { totalPrice: true },
  });
  return {
    revenueMinor: orders.reduce(
      (sum, o) => sum + parseTmtMinor(o.totalPrice),
      0,
    ),
    orders: orders.length,
  };
}

export const revenueRollups: DailyRollup[] = [
  {
    metrics: [STORED.revenue, STORED.ordersCompleted],
    reads: ['orders'],
    build: async (day) => {
      const { revenueMinor, orders } = await completedOrdersOn(day);
      return [
        Prisma.sql`
          INSERT INTO "AnalyticsDaily" ("day", "metric", "dimension", "dimensionValue", "value")
          VALUES
            (${sqlDate(day)}, ${STORED.revenue}, '', '', ${BigInt(revenueMinor)}),
            (${sqlDate(day)}, ${STORED.ordersCompleted}, '', '', ${BigInt(orders)})
          ON CONFLICT ("metric", "day", "dimension", "dimensionValue")
          DO UPDATE SET "value" = EXCLUDED."value"`,
      ];
    },
  },
];

const revenueTmt = async (from: string, to: string) =>
  (await sumDaily(STORED.revenue, from, to)) / TMT_MINOR_UNITS;

const ordersCompleted = (from: string, to: string) =>
  sumDaily(STORED.ordersCompleted, from, to);

export const revenueWidgets = {
  kpi_revenue: (p) => kpi(p, revenueTmt),

  kpi_orders_completed: (p) => kpi(p, ordersCompleted),

  kpi_aov: (p) =>
    kpi(p, async (from, to) => {
      const [revenue, orders] = await Promise.all([
        revenueTmt(from, to),
        ordersCompleted(from, to),
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
