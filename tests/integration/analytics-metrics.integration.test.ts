import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { MetricId } from '@/lib/analytics/metrics/catalog';
import type {
  FunnelData,
  KpiData,
  MetricQueryParams,
  TimeseriesData,
  TopNData,
  WidgetData,
} from '@/lib/analytics/metrics/types';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import {
  cleanupAnalyticsFixture,
  D1,
  insertEvents,
  NOW,
  OLD_EVENTS,
  OLD_NOW,
  seedAnalyticsFixture,
  useSessionTimeZone,
  wipeAnalytics,
  type AnalyticsFixture,
} from './shared/analytics-fixture';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

type MetricsModule = typeof import('@/lib/analytics/metrics');
type CatalogModule = typeof import('@/lib/analytics/metrics/catalog');

describe('analytics metric queries (integration)', () => {
  let prisma: PrismaClient;
  let fx: AnalyticsFixture;
  let metrics: MetricsModule;
  let catalog: CatalogModule;

  const query = (
    id: MetricId,
    params: Partial<MetricQueryParams> & { from: string; to: string },
    now: Date = NOW,
  ): Promise<WidgetData> =>
    metrics.queryWidget(
      id,
      { granularity: 'day', limit: 10, locale: 'en', ...params },
      { now },
    );

  const kpi = async (
    id: MetricId,
    from: string,
    to: string,
    now: Date = NOW,
  ) => {
    const data = (await query(id, { from, to }, now)) as KpiData;
    expect(data.kind).toBe('kpi');
    return { value: data.value, previous: data.previous };
  };

  const top = async (id: MetricId, params: Parameters<typeof query>[1]) => {
    const data = (await query(id, params)) as TopNData;
    expect(data.kind).toBe('topN');
    return data.rows;
  };

  const series = async (
    id: MetricId,
    params: Parameters<typeof query>[1],
    now: Date = NOW,
  ) => {
    const data = (await query(id, params, now)) as TimeseriesData;
    expect(data.kind).toBe('timeseries');
    return Object.fromEntries(
      data.series.map((s) => [
        s.key,
        {
          labelKey: s.labelKey,
          periods: s.points.map((p) => p.period),
          values: s.points.map((p) => p.value),
        },
      ]),
    );
  };

  const funnel = async (from: string, to: string) => {
    const data = (await query('funnel', { from, to })) as FunnelData;
    expect(data.kind).toBe('funnel');
    return data.steps;
  };

  const setWeekRow = (day: string, value: bigint) =>
    prisma.analyticsDaily.upsert({
      where: {
        metric_day_dimension_dimensionValue: {
          metric: 'visitors_week',
          day: new Date(`${day}T00:00:00Z`),
          dimension: '',
          dimensionValue: '',
        },
      },
      create: {
        metric: 'visitors_week',
        day: new Date(`${day}T00:00:00Z`),
        value,
      },
      update: { value },
    });

  beforeAll(async () => {
    const { databaseUrl: baseUrl, catalog: integrationCatalog } =
      await prepareIntegrationWorker();
    const databaseUrl = useSessionTimeZone(baseUrl);
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    fx = await seedAnalyticsFixture(prisma, integrationCatalog);
    await insertEvents(prisma, OLD_EVENTS);

    const rollup = await import('@/lib/analytics/rollup');
    await rollup.rollupRange('2025-01-18', '2025-02-05', { now: NOW });
    await rollup.rollupRange('2024-10-05', '2024-10-08', { now: OLD_NOW });
    // October's week and month rows, counted once October was over (while
    // its raw events still existed).
    await rollup.rollupPeriodUniques('2024-10-08', {
      now: new Date('2024-11-02T07:00:00Z'),
    });

    metrics = await import('@/lib/analytics/metrics');
    catalog = await import('@/lib/analytics/metrics/catalog');
  });

  afterAll(async () => {
    await wipeAnalytics(prisma);
    await cleanupAnalyticsFixture(prisma);
    await prisma.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('returns the catalog kind for every widget', async () => {
    const results = await Promise.all(
      catalog.WIDGETS.map(async (w) => ({
        id: w.id,
        expected: w.kind,
        kind: (await query(w.id, { from: D1, to: D1 })).kind,
      })),
    );
    results.forEach((r) => expect(r.kind, r.id).toBe(r.expected));
  });

  describe('traffic KPIs', () => {
    it('counts exact unique visitors, compared with the range before', async () => {
      expect(await kpi('kpi_visitors', D1, D1)).toEqual({
        value: 4,
        previous: 1,
      });
      // The week has 4+1+3+3 daily uniques but 8 distinct visitors.
      expect(await kpi('kpi_visitors', '2025-01-27', '2025-02-02')).toEqual({
        value: 8,
        previous: 1,
      });
    });

    it('counts sessions and page views', async () => {
      expect(await kpi('kpi_sessions', D1, D1)).toEqual({
        value: 3,
        previous: 0,
      });
      expect(await kpi('kpi_pageviews', '2025-01-27', '2025-02-02')).toEqual({
        value: 9,
        previous: 1,
      });
    });
  });

  describe('order KPIs', () => {
    it('counts orders placed', async () => {
      expect(await kpi('kpi_orders_placed', D1, D1)).toEqual({
        value: 2,
        previous: 0,
      });
      expect(
        await kpi('kpi_orders_placed', '2025-01-27', '2025-02-02'),
      ).toEqual({ value: 3, previous: 0 });
    });

    it('computes conversion as orders placed per unique visitor, in percent', async () => {
      expect(await kpi('kpi_conversion', D1, D1)).toEqual({
        value: 50,
        previous: 0,
      });
      expect(await kpi('kpi_conversion', '2025-01-27', '2025-02-02')).toEqual({
        value: 37.5,
        previous: 0,
      });
      // No visitors on the 25th: the previous rate is unknown.
      expect(await kpi('kpi_conversion', '2025-01-26', '2025-01-26')).toEqual({
        value: 0,
        previous: null,
      });
    });
  });

  describe('revenue', () => {
    it('sums only COMPLETED orders by their completedAt day, in TMT', async () => {
      expect(await kpi('kpi_revenue', D1, D1)).toEqual({
        value: 1505.5,
        previous: 999,
      });
      expect(await kpi('kpi_orders_completed', D1, D1)).toEqual({
        value: 3,
        previous: 1,
      });
    });

    it('divides revenue by completed orders for the AOV', async () => {
      expect(await kpi('kpi_aov', D1, D1)).toEqual({
        value: 501.83,
        previous: 999,
      });
      expect(await kpi('kpi_aov', '2025-01-29', '2025-01-30')).toEqual({
        value: 0,
        previous: 501.83,
      });
      expect(await kpi('kpi_aov', '2025-01-20', '2025-01-21')).toEqual({
        value: 0,
        previous: null,
      });
    });

    it('draws revenue alone per day, week and month', async () => {
      const daily = await series('revenue', {
        from: '2025-01-26',
        to: '2025-02-02',
      });
      expect(daily.revenue).toEqual({
        labelKey: 'analyticsRevenue',
        periods: [
          '2025-01-26',
          '2025-01-27',
          '2025-01-28',
          '2025-01-29',
          '2025-01-30',
          '2025-01-31',
          '2025-02-01',
          '2025-02-02',
        ],
        values: [999, 1505.5, 0, 0, 0, 0, 100, 300],
      });
      // The completed-order count has its own KPI, not a line on the TMT axis.
      expect(Object.keys(daily)).toEqual(['revenue']);

      const weekly = await series('revenue', {
        from: '2025-01-26',
        to: '2025-02-02',
        granularity: 'week',
      });
      expect(weekly.revenue.periods).toEqual(['2025-01-20', '2025-01-27']);
      expect(weekly.revenue.values).toEqual([999, 1905.5]);
      expect(Object.keys(weekly)).toEqual(['revenue']);

      const monthly = await series('revenue', {
        from: '2025-01-01',
        to: '2025-02-28',
        granularity: 'month',
      });
      expect(monthly.revenue.periods).toEqual(['2025-01-01', '2025-02-01']);
      expect(monthly.revenue.values).toEqual([2504.5, 400]);
    });
  });

  describe('traffic chart', () => {
    it('has one zero-filled point per day for each series', async () => {
      const s = await series('traffic', {
        from: '2025-01-26',
        to: '2025-01-28',
      });
      expect(Object.keys(s)).toEqual([
        'visitors',
        'sessions',
        'pageviews',
        'pageviews_web',
        'pageviews_app',
      ]);
      expect(s.visitors.periods).toEqual([
        '2025-01-26',
        '2025-01-27',
        '2025-01-28',
      ]);
      expect(s.visitors.values).toEqual([1, 4, 1]);
      expect(s.sessions.values).toEqual([0, 3, 0]);
      expect(s.pageviews.values).toEqual([1, 4, 1]);
      expect(s.pageviews_web).toEqual({
        labelKey: 'analyticsPageviewsWeb',
        periods: s.visitors.periods,
        values: [1, 2, 1],
      });
      expect(s.pageviews_app.values).toEqual([0, 2, 0]);
    });

    it('marks the weeks and months the range cuts short', async () => {
      // Wednesday 29.01 to Monday 03.02: 5 days of one week, 1 of the next.
      const week = (await query('traffic', {
        from: '2025-01-29',
        to: '2025-02-03',
        granularity: 'week',
      })) as TimeseriesData;
      expect(week.series[0].points.map((p) => p.partial)).toEqual([
        { days: 5, of: 7 },
        { days: 1, of: 7 },
      ]);
      // Whole weeks and single days are never partial.
      const whole = (await query('traffic', {
        from: '2025-01-27',
        to: '2025-02-02',
        granularity: 'week',
      })) as TimeseriesData;
      expect(whole.series[0].points[0].partial).toBeUndefined();
      const days = (await query('traffic', {
        from: '2025-01-29',
        to: '2025-01-30',
      })) as TimeseriesData;
      expect(days.series[0].points.every((p) => !p.partial)).toBe(true);
      // January 2025 has 31 days; 18.01–31.01 is 14 of them.
      const month = (await query('revenue', {
        from: '2025-01-18',
        to: '2025-02-05',
        granularity: 'month',
      })) as TimeseriesData;
      expect(month.series[0].points.map((p) => p.partial)).toEqual([
        { days: 14, of: 31 },
        { days: 5, of: 28 },
      ]);
    });

    it('counts distinct visitors per week, from the week rollup when it is final', async () => {
      const params = {
        from: '2025-01-27',
        to: '2025-02-03',
        granularity: 'week' as const,
      };
      let s = await series('traffic', params);
      expect(s.visitors.periods).toEqual(['2025-01-27', '2025-02-03']);
      expect(s.visitors.values).toEqual([8, 1]);
      expect(s.pageviews.values).toEqual([9, 1]);

      // A stored, final row for a whole week is used as is (a deliberately
      // wrong value proves it); the current week is still counted from raw.
      await setWeekRow('2025-01-27', 80n);
      await setWeekRow('2025-02-03', 50n);
      try {
        s = await series('traffic', params);
        expect(s.visitors.values).toEqual([80, 1]);

        // A week cut by the range is counted over the days in range.
        s = await series('traffic', { ...params, from: '2025-01-29' });
        expect(s.visitors.periods).toEqual(['2025-01-27', '2025-02-03']);
        expect(s.visitors.values).toEqual([4, 1]);
      } finally {
        await prisma.analyticsDaily.deleteMany({
          where: {
            metric: 'visitors_week',
            day: { gte: new Date('2025-01-01') },
          },
        });
      }
    });

    it('counts distinct visitors per month, clipped to the range', async () => {
      const s = await series('traffic', {
        from: '2025-01-15',
        to: '2025-02-05',
        granularity: 'month',
      });
      expect(s.visitors.periods).toEqual(['2025-01-01', '2025-02-01']);
      expect(s.visitors.values).toEqual([7, 3]);
      expect(s.pageviews.values).toEqual([8, 3]);
      expect(s.pageviews_app.values).toEqual([3, 0]);
    });
  });

  describe('funnel', () => {
    it('follows the same visitor through the steps within the range', async () => {
      expect(await funnel(D1, D1)).toEqual([
        {
          key: 'product_view',
          labelKey: 'analyticsFunnelProductView',
          value: 4,
        },
        { key: 'cart_add', labelKey: 'analyticsFunnelCartAdd', value: 2 },
        {
          key: 'order_placed',
          labelKey: 'analyticsFunnelOrderPlaced',
          value: 2,
        },
        {
          key: 'order_completed',
          labelKey: 'analyticsFunnelOrderCompleted',
          value: 1,
        },
      ]);
    });

    it('joins journeys across days and checks the order status now', async () => {
      const values = (await funnel('2025-01-27', '2025-02-02')).map(
        (s) => s.value,
      );
      // + H, who viewed on the 31st and bought (o8, completed) on the 1st.
      expect(values).toEqual([5, 3, 3, 2]);

      await prisma.userOrder.update({
        where: { id: fx.orders.o2 },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      try {
        const after = await funnel('2025-01-27', '2025-02-02');
        expect(after.map((s) => s.value)).toEqual([5, 3, 3, 3]);
      } finally {
        await prisma.userOrder.update({
          where: { id: fx.orders.o2 },
          data: { status: 'PENDING', completedAt: null },
        });
      }
    });
  });

  describe('top lists', () => {
    it('ranks products by views with names, images and links', async () => {
      const rows = await top('top_products', {
        from: '2025-01-27',
        to: '2025-02-02',
      });
      const ties = [fx.p2, fx.p3].sort();
      expect(rows.map((r) => [r.key, r.value])).toEqual([
        [fx.p1, 4],
        [ties[0], 1],
        [ties[1], 1],
      ]);
      expect(rows[0]).toEqual({
        key: fx.p1,
        label: 'Integration phone',
        value: 4,
        imageUrl: '/media/product/bad/integration-phone.webp',
        href: `/product/${fx.p1Slug}`,
      });
      // Soft-deleted: named, but not linked.
      expect(rows.find((r) => r.key === fx.p2)).toEqual({
        key: fx.p2,
        label: 'Deleted phone',
        value: 1,
      });
      // Unknown id: the key is the label.
      expect(rows.find((r) => r.key === fx.p3)).toEqual({
        key: fx.p3,
        label: fx.p3,
        value: 1,
      });
    });

    it('applies the limit and the viewer locale', async () => {
      const rows = await top('top_products', {
        from: '2025-01-27',
        to: '2025-02-02',
        limit: 1,
        locale: 'ru',
      });
      expect(rows.map((r) => r.key)).toEqual([fx.p1]);
      const ru = await top('top_products', { from: D1, to: D1, locale: 'ru' });
      expect(ru.find((r) => r.key === fx.p2)?.label).toBe('Удалённый');
    });

    it('ranks cart adds by product', async () => {
      const rows = await top('top_cart_adds', {
        from: '2025-01-27',
        to: '2025-02-02',
      });
      expect(rows.map((r) => [r.key, r.label, r.value])).toEqual([
        [fx.p1, 'Integration phone', 3],
        [fx.p2, 'Deleted phone', 1],
      ]);
    });

    it('ranks categories, linking parents to /category and leaves to /product-category', async () => {
      expect(await top('top_categories', { from: D1, to: D1 })).toEqual([
        {
          key: fx.catA,
          label: 'Phones',
          value: 2,
          href: `/category/${fx.catASlug}`,
        },
        {
          key: fx.catB,
          label: 'Smartphones',
          value: 1,
          imageUrl: '/media/category/smart.webp',
          href: `/product-category/${fx.catBSlug}`,
        },
      ]);
      const ru = await top('top_categories', {
        from: D1,
        to: D1,
        locale: 'ru',
      });
      expect(ru[0].label).toBe('Телефоны');
    });

    it('ranks normalised searches and zero-result searches', async () => {
      expect(await top('top_searches', { from: D1, to: D1 })).toEqual([
        { key: 'iphone 15', label: 'iphone 15', value: 2 },
        { key: 'samsung', label: 'samsung', value: 1 },
      ]);
      expect(await top('zero_result_searches', { from: D1, to: D1 })).toEqual([
        { key: 'iphone 15', label: 'iphone 15', value: 1 },
        { key: 'samsung', label: 'samsung', value: 1 },
      ]);
      expect(
        await top('zero_result_searches', { from: D1, to: D1, limit: 1 }),
      ).toHaveLength(1);
      expect(
        await top('top_searches', { from: '2025-01-28', to: '2025-01-30' }),
      ).toEqual([]);
    });
  });

  describe('breakdowns', () => {
    it('splits page views by platform', async () => {
      const range = { from: '2025-01-27', to: '2025-02-02' };
      const rows = await top('by_platform', range);
      expect(rows.map((r) => [r.key, r.value])).toEqual([
        ['WEB', 6],
        ['APP', 3],
      ]);
      // Page views, like by_locale and by_device: the split adds up to the
      // range's page views.
      expect(rows.reduce((sum, r) => sum + r.value, 0)).toBe(
        (await kpi('kpi_pageviews', range.from, range.to)).value,
      );
      expect(await top('by_platform', { ...range, limit: 1 })).toHaveLength(1);
    });

    it('splits page views by locale and device', async () => {
      expect(
        (await top('by_locale', { from: D1, to: D1 })).map((r) => [
          r.key,
          r.value,
        ]),
      ).toEqual([
        ['tk', 2],
        ['en', 1],
        ['ru', 1],
      ]);
      expect(
        (await top('by_device', { from: D1, to: D1 })).map((r) => [
          r.key,
          r.value,
        ]),
      ).toEqual([
        ['unknown', 2],
        ['desktop', 1],
        ['mobile', 1],
      ]);
    });

    it('ranks referrer hosts', async () => {
      expect(await top('top_referrers', { from: D1, to: D1 })).toEqual([
        { key: 'google.com', label: 'google.com', value: 1 },
        { key: 'yandex.ru', label: 'yandex.ru', value: 1 },
      ]);
    });
  });

  describe('ranges older than the raw window', () => {
    const OLD = { from: '2024-10-07', to: '2024-10-08' };

    it('bounds unique visitors with the daily and period rollups', async () => {
      // Daily uniques sum to 3 (X, Y; X), the stored week and month say 2.
      expect(await kpi('kpi_visitors', OLD.from, OLD.to)).toEqual({
        value: 2,
        previous: 0,
      });

      const week = await series('traffic', {
        from: '2024-10-07',
        to: '2024-10-13',
        granularity: 'week',
      });
      expect(week.visitors.values).toEqual([2]);
      const month = await series('traffic', {
        ...OLD,
        granularity: 'month',
      });
      expect(month.visitors.periods).toEqual(['2024-10-01']);
      expect(month.visitors.values).toEqual([2]);

      await prisma.analyticsDaily.deleteMany({
        where: {
          metric: { in: ['visitors_week', 'visitors_month'] },
          day: { lt: new Date('2024-11-01') },
        },
      });
      // Without period rows only the daily sum is left (an upper bound)…
      expect((await kpi('kpi_visitors', OLD.from, OLD.to)).value).toBe(3);
      // …while inside the raw window the same range is exact.
      expect((await kpi('kpi_visitors', OLD.from, OLD.to, OLD_NOW)).value).toBe(
        2,
      );
    });

    it('sums sessions, platform page views and daily funnels', async () => {
      expect((await kpi('kpi_sessions', OLD.from, OLD.to)).value).toBe(3);
      expect(
        (await top('by_platform', OLD)).map((r) => [r.key, r.value]),
      ).toEqual([
        ['WEB', 2],
        ['APP', 1],
      ]);
      // X's view (7th) and cart add (8th) are on different days.
      expect((await funnel(OLD.from, OLD.to)).map((s) => s.value)).toEqual([
        1, 0, 0, 0,
      ]);
      const exact = (await metrics.queryWidget(
        'funnel',
        { ...OLD, granularity: 'day', limit: 10, locale: 'en' },
        { now: OLD_NOW },
      )) as FunnelData;
      expect(exact.steps.map((s) => s.value)).toEqual([1, 1, 0, 0]);
    });
  });

  describe('ranges ending today that reach past the raw window', () => {
    // At NOW the raw window starts 2024-11-08. October has X and Y (daily
    // uniques 2 + 1, week and month rows 2); 11-08..02-05 has A..H.
    const RANGE = { from: '2024-10-07', to: '2025-02-05' };

    beforeAll(async () => {
      // An earlier test deletes October's period rows.
      const rollup = await import('@/lib/analytics/rollup');
      await rollup.rollupPeriodUniques('2024-10-08', {
        now: new Date('2024-11-02T07:00:00Z'),
      });
    });

    it('counts the raw-window part exactly and bounds only the older days', async () => {
      // Old code: the sum of every daily unique (16), since the current
      // week and month have no final row.
      expect((await kpi('kpi_visitors', RANGE.from, RANGE.to)).value).toBe(10);
      // Sessions: 3 daily sessions in October + 3 distinct in the window.
      expect((await kpi('kpi_sessions', RANGE.from, RANGE.to)).value).toBe(6);
      // Page views are summable, so the split is exact over any range.
      const platform = await top('by_platform', RANGE);
      expect(platform.reduce((sum, r) => sum + r.value, 0)).toBe(
        (await kpi('kpi_pageviews', RANGE.from, RANGE.to)).value,
      );
    });

    it('adds the exact raw-window funnel to the older daily funnels', async () => {
      const inWindow = (await funnel('2024-11-08', RANGE.to)).map(
        (s) => s.value,
      );
      // October's stored daily funnels: X's product view on the 7th (the
      // cart add on the 8th is another day).
      const october = [1, 0, 0, 0];
      expect((await funnel(RANGE.from, RANGE.to)).map((s) => s.value)).toEqual(
        inWindow.map((value, i) => value + october[i]),
      );
    });

    it('counts today live, before the next rollup', async () => {
      const visitor = '00000000-0000-4000-8000-0000000000f1';
      const before = await funnel(RANGE.from, RANGE.to);
      await insertEvents(prisma, [
        // 11:30 in Ashgabat on NOW's day; no rollup runs after it.
        {
          at: '2025-02-05T06:30:00Z',
          name: 'product_view',
          v: visitor,
          entity: fx.p1,
        },
      ]);
      try {
        const after = await funnel(RANGE.from, RANGE.to);
        expect(after[0].value).toBe(before[0].value + 1);
      } finally {
        await prisma.analyticsEvent.deleteMany({
          where: { visitorId: visitor },
        });
      }
    });

    it('splits a chart period that straddles the window start', async () => {
      const s = await series('traffic', {
        from: '2024-10-01',
        to: RANGE.to,
        granularity: 'month',
      });
      expect(s.visitors.periods).toEqual([
        '2024-10-01',
        '2024-11-01',
        '2024-12-01',
        '2025-01-01',
        '2025-02-01',
      ]);
      expect(s.visitors.values).toEqual([2, 0, 0, 7, 3]);
    });

    it('has no previous value when only one side is exact', async () => {
      // 11-08..02-05 is all raw (exact); the 90 days before only bounded.
      const exactNow = { from: '2024-11-08', to: '2025-02-05' };
      expect(await kpi('kpi_visitors', exactNow.from, exactNow.to)).toEqual({
        value: 8,
        previous: null,
      });
      expect(
        (await kpi('kpi_sessions', exactNow.from, exactNow.to)).previous,
      ).toBeNull();
      expect(
        (await kpi('kpi_conversion', exactNow.from, exactNow.to)).previous,
      ).toBeNull();
      // Sums of daily rows are exact either way.
      expect(await kpi('kpi_pageviews', exactNow.from, exactNow.to)).toEqual({
        value: 11,
        previous: 3,
      });
      // Both bounds: compared.
      expect(await kpi('kpi_visitors', RANGE.from, RANGE.to)).toEqual({
        value: 10,
        previous: 0,
      });
    });
  });

  describe('ranges ending today, compared at the same time of day', () => {
    // 11:00 on 2025-01-28 in Ashgabat. Yesterday (D1) up to 11:00 had A's
    // page view at 00:00, A's and B's events up to 10:55, o1 placed at 10:20
    // and o3 completed at 00:00; B's page views start at 11:00 sharp.
    const AT = new Date('2025-01-28T06:00:00Z');
    const TODAY = '2025-01-28';

    it('cuts the previous day at the same time for event KPIs', async () => {
      expect(await kpi('kpi_pageviews', TODAY, TODAY, AT)).toEqual({
        value: 1,
        previous: 1,
      });
      expect(await kpi('kpi_visitors', TODAY, TODAY, AT)).toEqual({
        value: 1,
        previous: 2,
      });
      expect(await kpi('kpi_sessions', TODAY, TODAY, AT)).toEqual({
        value: 0,
        previous: 2,
      });
      expect(await kpi('kpi_orders_placed', TODAY, TODAY, AT)).toEqual({
        value: 0,
        previous: 1,
      });
      expect(await kpi('kpi_conversion', TODAY, TODAY, AT)).toEqual({
        value: 0,
        previous: 50,
      });
    });

    it('cuts revenue and completed orders by completedAt', async () => {
      expect(await kpi('kpi_revenue', TODAY, TODAY, AT)).toEqual({
        value: 0,
        previous: 200,
      });
      expect(await kpi('kpi_orders_completed', TODAY, TODAY, AT)).toEqual({
        value: 0,
        previous: 1,
      });
      expect(await kpi('kpi_aov', TODAY, TODAY, AT)).toEqual({
        value: 0,
        previous: 200,
      });
    });

    it('uses full days from the rollups for the rest of the ranges', async () => {
      // 01-27..01-28 now vs 01-25..01-26 up to 11:00 on the 26th: E's page
      // view at 23:59:59 on the 26th is after the cut.
      expect(await kpi('kpi_pageviews', D1, TODAY, AT)).toEqual({
        value: 5,
        previous: 0,
      });
      expect(await kpi('kpi_revenue', D1, TODAY, AT)).toEqual({
        value: 1505.5,
        previous: 0,
      });
    });

    it('counts a range ending today live, not from the 10-minute rollup', async () => {
      const visitor = '00000000-0000-4000-8000-000000000050';
      await insertEvents(prisma, [
        { at: '2025-01-28T05:00:00Z', name: 'page_view', v: visitor },
      ]);
      try {
        // Not rolled up yet, but already counted.
        expect((await kpi('kpi_pageviews', TODAY, TODAY, AT)).value).toBe(2);
      } finally {
        await prisma.analyticsEvent.deleteMany({
          where: { visitorId: visitor },
        });
      }
    });
  });

  describe('per-request context', () => {
    it('runs each raw distinct count once per context', async () => {
      const dbClient = (await import('@/lib/dbClient')).default;
      const spy = vi.spyOn(dbClient, '$queryRaw');
      try {
        const ctx = metrics.createQueryContext(NOW);
        const params = {
          from: '2025-01-27',
          to: '2025-02-02',
          granularity: 'day' as const,
          limit: 10,
          locale: 'en',
        };
        // rawDistinct's template is the only one with `count(DISTINCT `
        // followed by an interpolated column.
        const distinctScans = () =>
          spy.mock.calls.filter(([strings]) =>
            (strings as unknown as readonly string[])
              .join('?')
              .includes('count(DISTINCT ?)'),
          ).length;

        const visitors = (await metrics.queryWidget('kpi_visitors', params, {
          ctx,
        })) as KpiData;
        const afterFirst = distinctScans();
        const conversion = (await metrics.queryWidget(
          'kpi_conversion',
          params,
          {
            ctx,
          },
        )) as KpiData;
        expect(visitors.value).toBe(8);
        expect(conversion.value).toBe(37.5);
        // Current and previous range: two scans, none repeated.
        expect(afterFirst).toBe(2);
        expect(distinctScans()).toBe(2);

        await metrics.queryWidget('kpi_visitors', params, { now: NOW });
        expect(distinctScans()).toBe(4);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('funnel clock skew', () => {
    const SKEW = '00000000-0000-4000-8000-000000000051';
    const LATE = '00000000-0000-4000-8000-000000000052';

    afterAll(async () => {
      await prisma.analyticsEvent.deleteMany({
        where: { visitorId: { in: [SKEW, LATE] } },
      });
    });

    it('counts a cart add stamped a few seconds before its product view', async () => {
      // 2025-01-29 has no other events.
      await insertEvents(prisma, [
        // Browser clock a little ahead of the server's.
        {
          at: '2025-01-29T05:00:10Z',
          name: 'product_view',
          v: SKEW,
          entity: fx.p1,
        },
        {
          at: '2025-01-29T05:00:05Z',
          name: 'cart_add',
          v: SKEW,
          entity: fx.p1,
        },
        {
          at: '2025-01-29T05:00:00Z',
          name: 'order_placed',
          v: SKEW,
          entity: fx.orders.o8,
        },
        // Three minutes apart is a real "added before viewing".
        {
          at: '2025-01-29T06:03:00Z',
          name: 'product_view',
          v: LATE,
          entity: fx.p1,
        },
        {
          at: '2025-01-29T06:00:00Z',
          name: 'cart_add',
          v: LATE,
          entity: fx.p1,
        },
      ]);
      expect(
        (await funnel('2025-01-29', '2025-01-29')).map((s) => s.value),
      ).toEqual([2, 1, 1, 1]);
    });
  });
});
