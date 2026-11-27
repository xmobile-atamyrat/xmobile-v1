import { Prisma } from '@prisma/client';

import dbClient from '@/lib/dbClient';

import { SERIES_LABEL_KEYS } from './catalog';
import {
  eventSumUntil,
  round2,
  storedOnlyTo,
  sumDailyBy,
  uniqueVisitors,
  type KpiRange,
  type QueryContext,
} from './sql';
import {
  DIM,
  eventsWhere,
  FUNNEL_STEPS,
  insertDaily,
  STORED,
  type DailyRollup,
  type FunnelStep,
} from './stored';
import { kpi, type WidgetGroup } from './widget';

/**
 * Orders placed, conversion and the purchase funnel.
 * Widgets: kpi_orders_placed, kpi_conversion, funnel.
 *
 * Funnel definition, over the Ashgabat days `from`..`to` (all four steps
 * count visitors, so the funnel can only narrow):
 * 1. product_view: visitors with at least one product_view in the range;
 * 2. cart_add: of those, visitors with a cart_add at or after their first
 *    product_view in the range;
 * 3. order_placed: of those, visitors with an order_placed at or after their
 *    first such cart_add;
 * 4. order_completed: of those, visitors for whom at least one of those
 *    step-3 orders is COMPLETED in UserOrder right now.
 *
 * "At or after" allows FUNNEL_CLOCK_SLACK of clock skew: product_view is
 * stamped by the browser, cart_add and order_placed by the server, so a cart
 * add a few seconds "before" its product view still follows it.
 */

/** SQL interval a later step may appear to precede the earlier one by. */
export const FUNNEL_CLOCK_SLACK = '2 minutes';
const SLACK_SQL = Prisma.raw(`interval '${FUNNEL_CLOCK_SLACK}'`);

const FUNNEL_LABEL_KEYS: Record<FunnelStep, string> = {
  product_view: SERIES_LABEL_KEYS.funnelProductView,
  cart_add: SERIES_LABEL_KEYS.funnelCartAdd,
  order_placed: SERIES_LABEL_KEYS.funnelOrderPlaced,
  order_completed: SERIES_LABEL_KEYS.funnelOrderCompleted,
};

/** One row with a bigint column per funnel step, from raw events. */
function funnelSelect(from: string, to: string): Prisma.Sql {
  return Prisma.sql`
    WITH ev AS (
      SELECT "visitorId" AS v, "name" AS n, "occurredAt" AS t, "entityId" AS e
      FROM "AnalyticsEvent"
      WHERE ${eventsWhere(from, to, ['product_view', 'cart_add', 'order_placed'])}
    ),
    s1 AS (
      SELECT v, min(t) AS t FROM ev WHERE n = 'product_view' GROUP BY v
    ),
    s2 AS (
      SELECT ev.v, min(ev.t) AS t
      FROM ev JOIN s1 ON s1.v = ev.v AND ev.t >= s1.t - ${SLACK_SQL}
      WHERE ev.n = 'cart_add'
      GROUP BY ev.v
    ),
    s3 AS (
      SELECT ev.v, ev.e
      FROM ev JOIN s2 ON s2.v = ev.v AND ev.t >= s2.t - ${SLACK_SQL}
      WHERE ev.n = 'order_placed'
    ),
    s4 AS (
      SELECT DISTINCT s3.v
      FROM s3 JOIN "UserOrder" o ON o."id" = s3.e
      WHERE o."status" = 'COMPLETED'
    )
    SELECT
      (SELECT count(*) FROM s1)::bigint AS product_view,
      (SELECT count(*) FROM s2)::bigint AS cart_add,
      (SELECT count(DISTINCT v) FROM s3)::bigint AS order_placed,
      (SELECT count(*) FROM s4)::bigint AS order_completed`;
}

const emptyFunnel = (): Record<FunnelStep, number> =>
  Object.fromEntries(FUNNEL_STEPS.map((step) => [step, 0])) as Record<
    FunnelStep,
    number
  >;

/** Sum of the stored daily funnels over `from`..`to`. */
async function storedFunnel(
  from: string,
  to: string,
): Promise<Record<FunnelStep, number>> {
  const rows = await sumDailyBy(STORED.funnel, DIM.step, from, to);
  const byStep = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(
    FUNNEL_STEPS.map((step) => [step, byStep.get(step) ?? 0]),
  ) as Record<FunnelStep, number>;
}

/** Exact funnel over `from`..`to` from raw events. */
export async function rawFunnel(
  from: string,
  to: string,
): Promise<Record<FunnelStep, number>> {
  const [row] = await dbClient.$queryRaw<Record<FunnelStep, bigint>[]>(
    funnelSelect(from, to),
  );
  return Object.fromEntries(
    FUNNEL_STEPS.map((step) => [step, Number(row?.[step] ?? 0)]),
  ) as Record<FunnelStep, number>;
}

export const ordersRollups: DailyRollup[] = [
  {
    metrics: [STORED.ordersPlaced],
    reads: ['events'],
    build: (day) => [
      insertDaily(
        day,
        STORED.ordersPlaced,
        Prisma.sql`
          SELECT ${DIM.total} AS dimension, '' AS dimension_value,
                 count(DISTINCT "entityId")::bigint AS value
          FROM "AnalyticsEvent"
          WHERE ${eventsWhere(day, day, ['order_placed'])}`,
      ),
    ],
  },
  {
    // Step 4 depends on the order's current status, so the nightly job
    // refreshes these rows for every day still in the raw window.
    metrics: [STORED.funnel],
    reads: ['events', 'orders'],
    build: (day) => [
      insertDaily(
        day,
        STORED.funnel,
        Prisma.sql`
          SELECT ${DIM.step} AS dimension, x.step AS dimension_value, x.value
          FROM (${funnelSelect(day, day)}) AS f
          CROSS JOIN LATERAL (VALUES
            ('product_view', f.product_view),
            ('cart_add', f.cart_add),
            ('order_placed', f.order_placed),
            ('order_completed', f.order_completed)
          ) AS x(step, value)`,
      ),
    ],
  },
];

const ordersPlaced = (ctx: QueryContext, range: KpiRange) =>
  eventSumUntil(ctx, STORED.ordersPlaced, range, 'order_placed', {
    distinctEntity: true,
  });

export const ordersWidgets = {
  kpi_orders_placed: (p) => kpi(p, (range) => ordersPlaced(p.ctx, range)),

  // A lower bound when the visitor count is only an upper bound.
  kpi_conversion: (p) =>
    kpi(p, async (range) => {
      const [orders, visitors] = await Promise.all([
        ordersPlaced(p.ctx, range),
        uniqueVisitors(range, p.ctx),
      ]);
      return {
        value:
          visitors.value > 0 ? round2((orders / visitors.value) * 100) : null,
        exact: visitors.exact,
      };
    }),

  /**
   * Exact inside the raw window. A range that starts before it is split at
   * the window's first day, like kpi_visitors: the older days sum their
   * stored daily funnels (which only see journeys within one day, and count
   * a visitor once per day), the rest is counted exactly from raw events.
   * So today is always live, whatever the range's start.
   */
  funnel: async ({ from, to, ctx }) => {
    const [old, recent] = await Promise.all([
      from < ctx.rawFrom
        ? storedFunnel(from, storedOnlyTo(to, ctx))
        : emptyFunnel(),
      to >= ctx.rawFrom
        ? rawFunnel(from < ctx.rawFrom ? ctx.rawFrom : from, to)
        : emptyFunnel(),
    ]);
    const values = Object.fromEntries(
      FUNNEL_STEPS.map((step) => [step, old[step] + recent[step]]),
    ) as Record<FunnelStep, number>;
    return {
      kind: 'funnel',
      steps: FUNNEL_STEPS.map((step) => ({
        key: step,
        labelKey: FUNNEL_LABEL_KEYS[step],
        value: values[step],
      })),
    };
  },
} satisfies WidgetGroup;
