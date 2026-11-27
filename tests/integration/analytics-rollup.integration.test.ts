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
  seedAnalyticsFixture,
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

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
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

  it('writes zero totals for an empty day and no grouped rows', async () => {
    expect(await rowsOf('2025-01-29')).toEqual({
      'funnel|step|cart_add': 0,
      'funnel|step|order_completed': 0,
      'funnel|step|order_placed': 0,
      'funnel|step|product_view': 0,
      'orders_completed||': 0,
      'orders_placed||': 0,
      'pageviews||': 0,
      'revenue_tmt||': 0,
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
    // Thursday 2025-01-30: week 01-27..02-02 and January.
    await rollup.rollupPeriodUniques('2025-01-30', { now: NOW });
    expect(await valueOf('2025-01-27', 'visitors_week')).toBe(8);
    expect(await valueOf('2025-01-01', 'visitors_month')).toBe(7);

    // Sunday 2025-02-02 is still the same ISO week; February has A, G, H.
    await rollup.rollupPeriodUniques('2025-02-02', { now: NOW });
    expect(await valueOf('2025-01-27', 'visitors_week')).toBe(8);
    expect(await valueOf('2025-02-01', 'visitors_month')).toBe(3);

    await rollup.rollupPeriodUniques('2025-02-03', { now: NOW });
    expect(await valueOf('2025-02-03', 'visitors_week')).toBe(1);
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

    await prisma.analyticsEvent.deleteMany({
      where: { occurredAt: { lt: new Date('2024-11-01T00:00:00Z') } },
    });
    await prisma.userOrder.create({
      data: {
        orderNumber: 'AN-TEST-old',
        status: 'COMPLETED',
        totalPrice: '50',
        deliveryAddress: 'Ashgabat',
        deliveryPhone: '+99360000000',
        completedAt: new Date('2024-10-07T08:00:00Z'),
      },
    });

    // At NOW the 7th is outside the raw window: page views must survive.
    await rollup.rollupDay('2024-10-07', { now: NOW });
    expect(await valueOf('2024-10-07', 'pageviews')).toBe(2);
    expect(await valueOf('2024-10-07', 'visitors')).toBe(2);
    expect(await valueOf('2024-10-07', 'revenue_tmt')).toBe(5_000);

    // Period uniques that start before the window are left alone too.
    await rollup.rollupPeriodUniques('2024-10-08', { now: OLD_NOW });
    expect(await valueOf('2024-10-07', 'visitors_week')).toBe(0);
    await prisma.analyticsDaily.update({
      where: {
        metric_day_dimension_dimensionValue: {
          metric: 'visitors_week',
          day: new Date('2024-10-07T00:00:00Z'),
          dimension: '',
          dimensionValue: '',
        },
      },
      data: { value: 2n },
    });
    await rollup.rollupPeriodUniques('2024-10-08', { now: NOW });
    expect(await valueOf('2024-10-07', 'visitors_week')).toBe(2);

    // ignoreRetention forces the recompute (for backfills with raw data).
    await rollup.rollupDay('2024-10-07', { now: NOW, ignoreRetention: true });
    expect(await valueOf('2024-10-07', 'pageviews')).toBe(0);
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

    it('analytics-rollup-nightly finalizes yesterday and its periods', async () => {
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
          yesterday: '2025-02-02',
          refreshedFrom: '2024-11-06',
          refreshedTo: '2025-02-01',
        });
        expect(await valueOf('2025-01-27', 'visitors_week')).toBe(8);
        expect(await valueOf('2025-02-01', 'visitors_month')).toBe(3);
        expect(await valueOf('2025-02-02', 'revenue_tmt')).toBe(30_000);
        // Earlier days get their order outcomes refreshed…
        expect(await valueOf(D1, 'revenue_tmt')).toBe(20_000);
        expect(await valueOf('2025-02-01', 'revenue_tmt')).toBe(10_000);
        // …but not their event metrics.
        expect(await valueOf('2025-02-01', 'pageviews')).toBeUndefined();
      } finally {
        await prisma.userOrder.update({
          where: { id: fx.orders.o1 },
          data: { status: 'COMPLETED' },
        });
        await rollup.rollupRange('2025-01-26', '2025-02-03', { now: NOW });
      }
    });
  });
});
