import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import {
  cleanupAnalyticsFixture,
  D1,
  insertEvents,
  NOW,
  OLD_EVENTS,
  OLD_NOW,
  ORDER_PREFIX,
  seedAnalyticsFixture,
  SESSION_TIME_ZONE,
  useSessionTimeZone,
  wipeAnalytics,
  type AnalyticsFixture,
} from './shared/analytics-fixture';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

type RollupModule = typeof import('@/lib/analytics/rollup');

describe('analytics rollups (integration)', () => {
  let prisma: PrismaClient;
  let fx: AnalyticsFixture;
  let rollup: RollupModule;

  /** Every stored row of a day as `metric|dimension|dimensionValue` → value. */
  const rowsOf = async (day: string) => {
    const rows = await prisma.analyticsDaily.findMany({
      where: { day: new Date(`${day}T00:00:00Z`) },
    });
    return Object.fromEntries(
      rows
        .map((r) => [
          `${r.metric}|${r.dimension}|${r.dimensionValue}`,
          Number(r.value),
        ])
        .sort(([a], [b]) => String(a).localeCompare(String(b))),
    );
  };

  const valueOf = async (
    day: string,
    metric: string,
    dimension = '',
    dimensionValue = '',
  ) => {
    const row = await prisma.analyticsDaily.findUnique({
      where: {
        metric_day_dimension_dimensionValue: {
          metric,
          day: new Date(`${day}T00:00:00Z`),
          dimension,
          dimensionValue,
        },
      },
    });
    return row ? Number(row.value) : undefined;
  };

  const createOrder = (
    suffix: string,
    totalPrice: string,
    completedAt: string | null,
    status: 'COMPLETED' | 'PENDING' = 'COMPLETED',
  ) =>
    prisma.userOrder.create({
      data: {
        orderNumber: `${ORDER_PREFIX}${suffix}`,
        status,
        totalPrice,
        deliveryAddress: 'Ashgabat',
        deliveryPhone: '+99360000000',
        completedAt: completedAt ? new Date(completedAt) : null,
      },
    });

  beforeAll(async () => {
    const { databaseUrl: baseUrl, catalog } = await prepareIntegrationWorker();
    const databaseUrl = useSessionTimeZone(baseUrl);
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    fx = await seedAnalyticsFixture(prisma, catalog);
    rollup = await import('@/lib/analytics/rollup');
    await rollup.rollupRange('2025-01-26', '2025-02-03', { now: NOW });
  });

  afterAll(async () => {
    await wipeAnalytics(prisma);
    await cleanupAnalyticsFixture(prisma);
    await prisma.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  const expectedD1 = () => ({
    [`cart_adds|product|${fx.p1}`]: 2,
    [`cart_adds|product|${fx.p2}`]: 1,
    [`category_views|category|${fx.catA}`]: 2,
    [`category_views|category|${fx.catB}`]: 1,
    'funnel|step|cart_add': 2,
    'funnel|step|order_completed': 1,
    'funnel|step|order_placed': 2,
    'funnel|step|product_view': 4,
    'orders_completed||': 3,
    'orders_placed||': 2,
    'pageviews||': 4,
    'pageviews|device|desktop': 1,
    'pageviews|device|mobile': 1,
    'pageviews|device|unknown': 2,
    'pageviews|locale|en': 1,
    'pageviews|locale|ru': 1,
    'pageviews|locale|tk': 2,
    'pageviews|platform|APP': 2,
    'pageviews|platform|WEB': 2,
    [`product_views|product|${fx.p1}`]: 2,
    [`product_views|product|${fx.p2}`]: 1,
    'product_views|product|missing-product': 1,
    'referrers|host|google.com': 1,
    'referrers|host|yandex.ru': 1,
    'revenue_tmt||': 150_550,
    'searches|query|iphone 15': 2,
    'searches|query|samsung': 1,
    'sessions||': 3,
    'visitors||': 4,
    'visitors|platform|APP': 1,
    'visitors|platform|WEB': 3,
    'zero_result_searches|query|iphone 15': 1,
    'zero_result_searches|query|samsung': 1,
  });

  it('runs against a non-UTC session TimeZone', async () => {
    const dbClient = (await import('@/lib/dbClient')).default;
    const [row] = await dbClient.$queryRaw<{ tz: string }[]>`
      SELECT current_setting('TimeZone') AS tz`;
    expect(row.tz).toBe(SESSION_TIME_ZONE);
  });

  it('stores every daily metric of a day, split on Ashgabat midnight', async () => {
    expect(await rowsOf(D1)).toEqual(expectedD1());
  });

  it('puts the events and orders either side of midnight in their own days', async () => {
    // 18:59:59.999 UTC on the 26th: page view and completed order of the 26th.
    expect(await valueOf('2025-01-26', 'pageviews')).toBe(1);
    expect(await valueOf('2025-01-26', 'visitors')).toBe(1);
    expect(await valueOf('2025-01-26', 'revenue_tmt')).toBe(99_900);
    expect(await valueOf('2025-01-26', 'orders_completed')).toBe(1);
    // 19:00 UTC on the 27th belongs to the 28th.
    expect(await valueOf('2025-01-28', 'pageviews')).toBe(1);
    expect(await valueOf('2025-01-28', 'visitors')).toBe(1);
  });

  it('writes zero totals for an empty day, no grouped rows and no revenue rows', async () => {
    // Revenue rows only exist for days with a completed order.
    expect(await rowsOf('2025-01-29')).toEqual({
      'funnel|step|cart_add': 0,
      'funnel|step|order_completed': 0,
      'funnel|step|order_placed': 0,
      'funnel|step|product_view': 0,
      'orders_placed||': 0,
      'pageviews||': 0,
      'sessions||': 0,
      'visitors||': 0,
    });
  });

  it('only sees same-day journeys in the daily funnel', async () => {
    // H viewed on the 31st and bought on the 1st.
    expect(await valueOf('2025-01-31', 'funnel', 'step', 'product_view')).toBe(
      2,
    );
    expect(await valueOf('2025-01-31', 'funnel', 'step', 'cart_add')).toBe(0);
    expect(await valueOf('2025-02-01', 'funnel', 'step', 'cart_add')).toBe(0);
    expect(await valueOf('2025-02-01', 'orders_placed')).toBe(1);
    expect(await valueOf('2025-02-01', 'revenue_tmt')).toBe(10_000);
    expect(await valueOf('2025-02-02', 'revenue_tmt')).toBe(30_000);
  });

  it('is idempotent and replaces stale rows of its own metrics only', async () => {
    const before = await rowsOf(D1);
    const day = new Date(`${D1}T00:00:00Z`);
    await prisma.analyticsDaily.createMany({
      data: [
        // A product that no longer has views that day: must go.
        {
          day,
          metric: 'product_views',
          dimension: 'product',
          dimensionValue: 'ghost',
          value: 9n,
        },
        // D1 is a Monday, so its week row has the same `day`: must stay.
        { day, metric: 'visitors_week', value: 42n },
      ],
    });

    await rollup.rollupDay(D1, { now: NOW });
    await rollup.rollupDay(D1, { now: NOW });

    expect(await rowsOf(D1)).toEqual({ ...before, 'visitors_week||': 42 });
    await prisma.analyticsDaily.deleteMany({
      where: { day, metric: 'visitors_week' },
    });
  });

  it('survives concurrent runs of the same day', async () => {
    await Promise.all([
      rollup.rollupDay(D1, { now: NOW }),
      rollup.rollupDay(D1, { now: NOW }),
      rollup.rollupDay(D1, { now: NOW }),
    ]);
    expect(await rowsOf(D1)).toEqual(expectedD1());
  });

  it('stores ISO-week and month unique visitors on the period start', async () => {
    // Thursday 2025-01-30: week 01-27..02-02 and January, both over at NOW.
    await rollup.rollupPeriodUniques('2025-01-30', { now: NOW });
    expect(await valueOf('2025-01-27', 'visitors_week')).toBe(8);
    expect(await valueOf('2025-01-01', 'visitors_month')).toBe(7);

    // February and the week of 02-03 are still in progress at NOW: no rows.
    await rollup.rollupPeriodUniques('2025-02-03', { now: NOW });
    expect(await valueOf('2025-02-03', 'visitors_week')).toBeUndefined();
    expect(await valueOf('2025-02-01', 'visitors_month')).toBeUndefined();
  });

  it('only stores a period once it is over (plus the late-events grace)', async () => {
    // The week 01-27..02-02 ends at 2025-02-02T19:00Z; the grace is 1h.
    await prisma.analyticsDaily.deleteMany({
      where: { metric: 'visitors_week' },
    });
    await rollup.rollupPeriodUniques('2025-02-02', {
      now: new Date('2025-02-02T19:59:59Z'),
    });
    expect(await valueOf('2025-01-27', 'visitors_week')).toBeUndefined();
    await rollup.rollupPeriodUniques('2025-02-02', {
      now: new Date('2025-02-02T20:00:00Z'),
    });
    expect(await valueOf('2025-01-27', 'visitors_week')).toBe(8);
  });

  it('deletes a row counted before its period ended', async () => {
    // A row for the current week (written by hand or by older code that
    // stored partial counts) must not survive to pass for a final one.
    await prisma.analyticsDaily.create({
      data: {
        day: new Date('2025-02-03T00:00:00Z'),
        metric: 'visitors_week',
        value: 99n,
      },
    });
    await rollup.rollupPeriodUniques('2025-02-04', { now: NOW });
    expect(await valueOf('2025-02-03', 'visitors_week')).toBeUndefined();
  });

  it('drops orders that left COMPLETED on recompute, and counts new ones', async () => {
    await prisma.userOrder.update({
      where: { id: fx.orders.o1 },
      data: { status: 'IN_PROGRESS' },
    });
    await prisma.userOrder.update({
      where: { id: fx.orders.o2 },
      data: { status: 'COMPLETED', completedAt: new Date('2025-01-28T06:00Z') },
    });
    try {
      await rollup.refreshOrderOutcomes('2025-01-27', '2025-01-28', {
        now: NOW,
      });
      expect(await valueOf(D1, 'revenue_tmt')).toBe(20_000); // o3 + o5
      expect(await valueOf(D1, 'orders_completed')).toBe(2);
      // C's order (placed on D1) is now completed, A's isn't.
      expect(await valueOf(D1, 'funnel', 'step', 'order_completed')).toBe(1);
      expect(await valueOf('2025-01-28', 'revenue_tmt')).toBe(70_000);
      // Event-only metrics are untouched by the refresh.
      expect(await valueOf(D1, 'pageviews')).toBe(4);

      // A full recompute agrees.
      await rollup.rollupDay(D1, { now: NOW });
      expect(await valueOf(D1, 'revenue_tmt')).toBe(20_000);
    } finally {
      await prisma.userOrder.update({
        where: { id: fx.orders.o1 },
        data: { status: 'COMPLETED' },
      });
      await prisma.userOrder.update({
        where: { id: fx.orders.o2 },
        data: { status: 'PENDING', completedAt: null },
      });
      await rollup.rollupRange('2025-01-27', '2025-01-28', { now: NOW });
    }
    expect(await valueOf(D1, 'revenue_tmt')).toBe(150_550);
  });

  it('only refreshes order metrics for days whose raw events were pruned', async () => {
    await insertEvents(prisma, OLD_EVENTS);
    await rollup.rollupRange('2024-10-07', '2024-10-08', { now: OLD_NOW });
    expect(await valueOf('2024-10-07', 'pageviews')).toBe(2);
    // The week of 10-07 is still in progress at OLD_NOW (10-10): no row…
    await rollup.rollupPeriodUniques('2024-10-08', { now: OLD_NOW });
    expect(await valueOf('2024-10-07', 'visitors_week')).toBeUndefined();
    // …until it is over (01:00 on Tuesday 10-15 in Ashgabat).
    await rollup.rollupPeriodUniques('2024-10-08', {
      now: new Date('2024-10-14T20:00:00Z'),
    });
    expect(await valueOf('2024-10-07', 'visitors_week')).toBe(2);

    await prisma.analyticsEvent.deleteMany({
      where: { occurredAt: { lt: new Date('2024-11-01T00:00:00Z') } },
    });
    await createOrder('old', '50', '2024-10-07T08:00:00Z');

    // At NOW the 7th is outside the raw window: page views must survive.
    await rollup.rollupDay('2024-10-07', { now: NOW });
    expect(await valueOf('2024-10-07', 'pageviews')).toBe(2);
    expect(await valueOf('2024-10-07', 'visitors')).toBe(2);
    expect(await valueOf('2024-10-07', 'revenue_tmt')).toBe(5_000);

    // Period uniques that start before the window are left alone too, and
    // October (complete, but its raw events are gone) isn't written.
    await rollup.rollupPeriodUniques('2024-10-08', { now: NOW });
    expect(await valueOf('2024-10-07', 'visitors_week')).toBe(2);
    expect(await valueOf('2024-10-01', 'visitors_month')).toBeUndefined();

    // ignoreRetention forces the recompute (for backfills with raw data).
    await rollup.rollupDay('2024-10-07', { now: NOW, ignoreRetention: true });
    expect(await valueOf('2024-10-07', 'pageviews')).toBe(0);
  });

  describe('revenue for every day', () => {
    afterAll(async () => {
      await prisma.userOrder.deleteMany({
        where: { orderNumber: { startsWith: `${ORDER_PREFIX}rev-` } },
      });
      await rollup.refreshRevenue();
    });

    it('fills days older than the raw window and drops days without completed orders', async () => {
      // Long before any raw window, and never rolled up by rollupDay.
      await createOrder('rev-1', '1000', '2024-03-10T08:00:00Z');
      await createOrder('rev-2', '250.25', '2024-03-10T20:00:00Z'); // 03-11 local
      await createOrder('rev-3', '999', null, 'PENDING');
      // A stale row for a day without completed orders.
      await prisma.analyticsDaily.create({
        data: {
          day: new Date('2024-03-12T00:00:00Z'),
          metric: 'revenue_tmt',
          value: 777n,
        },
      });

      await rollup.refreshRevenue();
      expect(await valueOf('2024-03-10', 'revenue_tmt')).toBe(100_000);
      expect(await valueOf('2024-03-10', 'orders_completed')).toBe(1);
      expect(await valueOf('2024-03-11', 'revenue_tmt')).toBe(25_025);
      expect(await valueOf('2024-03-12', 'revenue_tmt')).toBeUndefined();
      // The fixture's days are recomputed the same way.
      expect(await valueOf(D1, 'revenue_tmt')).toBe(150_550);
      expect(await valueOf(D1, 'orders_completed')).toBe(3);
      // Other metrics of those days are untouched.
      expect(await valueOf(D1, 'pageviews')).toBe(4);
    });

    it('counts an order completed again on a later day once, on the new day', async () => {
      // o7 (100 TMT) was completed on 02-01; it is reopened and completed
      // again on 02-02, where o8 (300 TMT) already is.
      await prisma.userOrder.update({
        where: { id: fx.orders.o7 },
        data: { completedAt: new Date('2025-02-02T09:00:00Z') },
      });
      try {
        await rollup.refreshRevenue();
        expect(await valueOf('2025-02-01', 'revenue_tmt')).toBeUndefined();
        expect(await valueOf('2025-02-01', 'orders_completed')).toBeUndefined();
        expect(await valueOf('2025-02-02', 'revenue_tmt')).toBe(40_000);
        expect(await valueOf('2025-02-02', 'orders_completed')).toBe(2);
      } finally {
        await prisma.userOrder.update({
          where: { id: fx.orders.o7 },
          data: { completedAt: new Date('2025-02-01T05:00:00Z') },
        });
        await rollup.refreshRevenue();
      }
      expect(await valueOf('2025-02-01', 'revenue_tmt')).toBe(10_000);
    });

    it('parses totalPrice in SQL exactly like parseTmtMinor', async () => {
      const { parseTmtMinor } = await import('@/lib/analytics/metrics/revenue');
      const totals = [
        '1290',
        '1305.50',
        '99.99',
        '0.01',
        '1283.0000000001',
        '19.995',
        ' 150 ',
        '\t42\n',
        '150 TMT',
        '1,5',
        '1e3',
        '12.345e1',
        '1e',
        '1e-5',
        '1e400',
        '1e1000',
        '+5',
        '.5',
        '5.',
        '0x10',
        '',
        'abc',
        'NaN',
        'Infinity',
        '-50',
        ' -5',
      ];
      // One order per day so each total is its own revenue row.
      await Promise.all(
        totals.map((total, i) =>
          createOrder(
            `rev-p${i}`,
            total,
            new Date(Date.UTC(2023, 0, 1 + i, 8)).toISOString(),
          ),
        ),
      );
      await rollup.refreshRevenue();
      const stored = await Promise.all(
        totals.map((_, i) =>
          valueOf(
            new Date(Date.UTC(2023, 0, 1 + i)).toISOString().slice(0, 10),
            'revenue_tmt',
          ),
        ),
      );
      expect(stored).toEqual(totals.map((t) => parseTmtMinor(t)));
    });

    it('reads orders only after taking the lock, so an older run cannot overwrite a newer one', async () => {
      // Another run holds the rollup lock while an admin un-completes o1.
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let lockTaken!: () => void;
      const taken = new Promise<void>((resolve) => {
        lockTaken = resolve;
      });
      const holder = prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('analytics-rollup'))`;
          lockTaken();
          await gate;
        },
        { timeout: 30_000 },
      );
      await taken;

      const day = rollup.rollupDay(D1, { now: NOW });
      const all = rollup.refreshRevenue();
      // Give both time to start (and, if they read before locking, to read).
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });
      await prisma.userOrder.update({
        where: { id: fx.orders.o1 },
        data: { status: 'IN_PROGRESS' },
      });
      try {
        release();
        await holder;
        await Promise.all([day, all]);
        // o3 + o5 only: both runs saw the update made while they waited.
        expect(await valueOf(D1, 'revenue_tmt')).toBe(20_000);
        expect(await valueOf(D1, 'orders_completed')).toBe(2);
      } finally {
        await prisma.userOrder.update({
          where: { id: fx.orders.o1 },
          data: { status: 'COMPLETED' },
        });
        await rollup.rollupDay(D1, { now: NOW });
      }
      expect(await valueOf(D1, 'revenue_tmt')).toBe(150_550);
    });
  });

  it('rejects malformed days', async () => {
    await expect(rollup.rollupDay('2025-02-30')).rejects.toThrow(
      'Invalid analytics day',
    );
    await expect(rollup.rollupDay("2025-01-01'; --")).rejects.toThrow();
  });

  describe('batch jobs', () => {
    it('analytics-rollup recomputes today, and yesterday right after midnight', async () => {
      const job = await import(
        '../../scripts/batch-runner/jobs/analytics-rollup'
      );
      vi.spyOn(console, 'log').mockImplementation(() => {});
      await prisma.analyticsDaily.deleteMany({
        where: {
          day: {
            in: [
              new Date('2025-01-27T00:00:00Z'),
              new Date('2025-01-28T00:00:00Z'),
            ],
          },
        },
      });

      // 00:30 on the 28th in Ashgabat.
      const days = await job.runAnalyticsRollup(
        new Date('2025-01-27T19:30:00Z'),
      );
      expect(days).toEqual(['2025-01-27', '2025-01-28']);
      expect(await rowsOf(D1)).toEqual(expectedD1());
      expect(await valueOf('2025-01-28', 'pageviews')).toBe(1);
    });

    it('analytics-rollup catches up once at start-up', async () => {
      const job = await import(
        '../../scripts/batch-runner/jobs/analytics-rollup'
      );
      vi.spyOn(console, 'log').mockImplementation(() => {});
      // A crash left holes: two days of rollups and the week that ended
      // meanwhile are missing; an old order was completed while down.
      await prisma.analyticsDaily.deleteMany({
        where: {
          day: {
            in: [
              new Date('2025-01-31T00:00:00Z'),
              new Date('2025-02-01T00:00:00Z'),
            ],
          },
        },
      });
      await prisma.analyticsDaily.deleteMany({
        where: { metric: { in: ['visitors_week', 'visitors_month'] } },
      });
      // January's row exists (if stale, the nightly run recounts it).
      await prisma.analyticsDaily.create({
        data: {
          day: new Date('2025-01-01T00:00:00Z'),
          metric: 'visitors_month',
          value: 5n,
        },
      });
      await createOrder('catchup', '42', '2024-05-05T08:00:00Z');

      try {
        // 08:00 on Monday 2025-02-03 in Ashgabat.
        const days = await job.runAnalyticsRollup(
          new Date('2025-02-03T03:00:00Z'),
          { catchUp: true },
        );
        // The catch-up re-rolled 01-27..02-02; only today is left.
        expect(days).toEqual(['2025-02-03']);
        expect(await valueOf('2025-01-31', 'pageviews')).toBe(2);
        expect(await valueOf('2025-02-01', 'revenue_tmt')).toBe(10_000);
        expect(await valueOf('2025-01-27', 'visitors_week')).toBe(8);
        expect(await valueOf('2025-01-01', 'visitors_month')).toBe(5);
        expect(await valueOf('2025-02-03', 'visitors_week')).toBeUndefined();
        expect(await valueOf('2024-05-05', 'revenue_tmt')).toBe(4_200);
      } finally {
        await prisma.userOrder.deleteMany({
          where: { orderNumber: `${ORDER_PREFIX}catchup` },
        });
        await rollup.refreshRevenue();
      }
    });

    it('analytics-rollup-nightly finalizes the last days, their periods and all revenue', async () => {
      const job = await import(
        '../../scripts/batch-runner/jobs/analytics-rollup-nightly'
      );
      vi.spyOn(console, 'log').mockImplementation(() => {});
      await prisma.analyticsDaily.deleteMany({
        where: { metric: { in: ['visitors_week', 'visitors_month'] } },
      });
      await prisma.analyticsDaily.deleteMany({
        where: { day: new Date('2025-02-01T00:00:00Z') },
      });
      await prisma.userOrder.update({
        where: { id: fx.orders.o1 },
        data: { status: 'IN_PROGRESS' },
      });

      try {
        // 01:30 on 2025-02-03 in Ashgabat.
        const result = await job.runAnalyticsRollupNightly(
          new Date('2025-02-02T20:30:00Z'),
        );
        expect(result).toEqual({
          rerolledFrom: '2025-01-27',
          rerolledTo: '2025-02-02',
          funnelFrom: '2024-11-06',
          funnelTo: '2025-01-26',
        });
        // The week that ended last night, and January; February is running.
        expect(await valueOf('2025-01-27', 'visitors_week')).toBe(8);
        expect(await valueOf('2025-01-01', 'visitors_month')).toBe(7);
        expect(await valueOf('2025-02-01', 'visitors_month')).toBeUndefined();
        // Revenue of every day follows the orders' current status…
        expect(await valueOf(D1, 'revenue_tmt')).toBe(20_000);
        expect(await valueOf('2025-02-02', 'revenue_tmt')).toBe(30_000);
        // …and the re-rolled days get their event metrics back.
        expect(await valueOf('2025-02-01', 'pageviews')).toBe(2);
        expect(await valueOf('2025-02-01', 'revenue_tmt')).toBe(10_000);
      } finally {
        await prisma.userOrder.update({
          where: { id: fx.orders.o1 },
          data: { status: 'COMPLETED' },
        });
        await rollup.rollupRange('2025-01-26', '2025-02-03', { now: NOW });
      }
    });

    it('analytics-rollup-nightly heals a missed Monday run and stale period rows', async () => {
      const job = await import(
        '../../scripts/batch-runner/jobs/analytics-rollup-nightly'
      );
      vi.spyOn(console, 'log').mockImplementation(() => {});
      await prisma.analyticsDaily.deleteMany({
        where: { metric: { in: ['visitors_week', 'visitors_month'] } },
      });
      // Counted mid-period (the week 01-27 on its Wednesday, January on the
      // 28th), then the run of Monday 02-03 01:30 never happened. The row of
      // the current week is a stale partial too.
      await prisma.analyticsDaily.createMany({
        data: [
          {
            day: new Date('2025-01-27T00:00:00Z'),
            metric: 'visitors_week',
            value: 5n,
          },
          {
            day: new Date('2025-01-01T00:00:00Z'),
            metric: 'visitors_month',
            value: 5n,
          },
          {
            day: new Date('2025-02-03T00:00:00Z'),
            metric: 'visitors_week',
            value: 1n,
          },
        ],
      });

      // 01:30 on Tuesday 2025-02-04 in Ashgabat.
      await job.runAnalyticsRollupNightly(new Date('2025-02-03T20:30:00Z'));
      expect(await valueOf('2025-01-27', 'visitors_week')).toBe(8);
      expect(await valueOf('2025-01-01', 'visitors_month')).toBe(7);
      expect(await valueOf('2025-02-03', 'visitors_week')).toBeUndefined();
    });
  });
});
