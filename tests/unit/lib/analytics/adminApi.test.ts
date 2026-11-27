import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  analyticsCacheKey,
  clearAnalyticsCaches,
  getAnalytics,
  PromiseCache,
  TELEKOM_TIMEOUT_MS,
  withTimeout,
} from '@/lib/analytics/adminApi';
import {
  alignRangeToPeriods,
  analyticsRequestPath,
  ashgabatDay,
  isValidDay,
  MAX_RANGE_DAYS,
  maxAnalyticsDay,
  MIN_ANALYTICS_DAY,
  parseAnalyticsQuery,
  periodStartOf,
  presetRange,
  rangeDays,
  shiftDay,
  visibleWidgetIds,
  type AnalyticsQuery,
} from '@/lib/analytics/adminQuery';
import { queryWidget } from '@/lib/analytics/metrics';
import { WIDGETS } from '@/lib/analytics/metrics/catalog';
import dbClient from '@/lib/dbClient';
import { fetchTelekomBalance } from '@/lib/telekom';

vi.mock('@/lib/analytics/metrics', () => ({
  queryWidget: vi.fn(),
  createQueryContext: vi.fn(() => ({ fake: 'ctx' })),
}));
vi.mock('@/lib/telekom', () => ({ fetchTelekomBalance: vi.fn() }));
vi.mock('@/lib/dbClient', () => ({
  default: { user: { count: vi.fn() } },
}));

// 20:00 UTC on the 27th is already 01:00 on the 28th in Ashgabat (UTC+5).
const NOW = new Date('2026-11-27T20:00:00Z');
const TODAY = '2026-11-28';

const STAFF_IDS = WIDGETS.filter((w) => w.access === 'staff').map((w) => w.id);
const ALL_IDS = WIDGETS.map((w) => w.id);

const parse = (query: Record<string, string | string[]>, superuser = false) =>
  parseAnalyticsQuery(query, { superuser, now: NOW });

const ok = (query: Record<string, string | string[]>, superuser = false) => {
  const result = parse(query, superuser);
  if ('message' in result) throw new Error(`expected ok: ${result.message}`);
  return result.value;
};

const error = (query: Record<string, string | string[]>) => {
  const result = parse(query);
  if (!('message' in result)) throw new Error('expected an error');
  return result.message;
};

describe('day helpers', () => {
  it('validates calendar days strictly', () => {
    expect(isValidDay('2026-11-28')).toBe(true);
    expect(isValidDay('2024-02-29')).toBe(true);
    expect(isValidDay('2026-02-29')).toBe(false);
    expect(isValidDay('2026-13-01')).toBe(false);
    expect(isValidDay('2026-1-01')).toBe(false);
    expect(isValidDay('28.11.2026')).toBe(false);
    expect(isValidDay('')).toBe(false);
  });

  it('shifts across months and years and counts inclusive days', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(rangeDays('2026-11-28', '2026-11-28')).toBe(1);
    expect(rangeDays('2026-01-01', '2026-12-31')).toBe(365);
  });

  it('takes today in Ashgabat, not UTC', () => {
    expect(ashgabatDay(NOW)).toBe(TODAY);
    expect(ashgabatDay(new Date('2026-11-27T18:59:59Z'))).toBe('2026-11-27');
  });

  it('builds preset ranges that end today', () => {
    expect(presetRange('7d', TODAY)).toEqual({
      from: '2026-11-22',
      to: TODAY,
    });
    expect(presetRange('30d', TODAY).from).toBe('2026-10-30');
    expect(presetRange('90d', TODAY).from).toBe('2026-08-31');
    expect(presetRange('12m', TODAY).from).toBe('2025-11-29');
    expect(rangeDays(presetRange('12m', TODAY).from, TODAY)).toBe(365);
  });

  it('builds the request path', () => {
    expect(
      analyticsRequestPath({
        from: '2026-11-01',
        to: '2026-11-28',
        granularity: 'week',
        locale: 'tk',
      }),
    ).toBe(
      '/api/admin/analytics?from=2026-11-01&to=2026-11-28&granularity=week&locale=tk',
    );
    expect(
      analyticsRequestPath({
        from: '2026-11-01',
        to: '2026-11-28',
        granularity: 'day',
        widgets: ['kpi_visitors', 'traffic'],
        limit: 5,
      }),
    ).toBe(
      '/api/admin/analytics?widgets=kpi_visitors%2Ctraffic&from=2026-11-01&to=2026-11-28&granularity=day&limit=5',
    );
  });
});

describe('period alignment', () => {
  it('finds the Monday and the 1st of a day', () => {
    // 2026-11-28 is a Saturday.
    expect(periodStartOf('2026-11-28', 'week')).toBe('2026-11-23');
    expect(periodStartOf('2026-11-23', 'week')).toBe('2026-11-23');
    expect(periodStartOf('2027-01-01', 'week')).toBe('2026-12-28');
    expect(periodStartOf('2026-11-28', 'month')).toBe('2026-11-01');
    expect(periodStartOf('2026-11-28', 'day')).toBe('2026-11-28');
  });

  it('starts week and month ranges on a whole period', () => {
    const range = presetRange('12m', TODAY);
    expect(alignRangeToPeriods(range, 'day')).toEqual(range);
    expect(alignRangeToPeriods(range, 'month')).toEqual({
      from: '2025-11-01',
      to: TODAY,
    });
    // 2025-11-29 is a Saturday.
    expect(alignRangeToPeriods(range, 'week')).toEqual({
      from: '2025-11-24',
      to: TODAY,
    });
    const aligned = { from: '2026-11-01', to: TODAY };
    expect(alignRangeToPeriods(aligned, 'month')).toEqual(aligned);
  });

  it('moves forward instead when moving back breaks a limit', () => {
    // Exactly two years: a month further back would be too long.
    const from = shiftDay(TODAY, -(MAX_RANGE_DAYS - 1));
    const month = alignRangeToPeriods({ from, to: TODAY }, 'month');
    expect(month.from.endsWith('-01')).toBe(true);
    expect(month.from > from).toBe(true);
    expect(rangeDays(month.from, TODAY)).toBeLessThanOrEqual(MAX_RANGE_DAYS);
    const week = alignRangeToPeriods({ from, to: TODAY }, 'week');
    expect(periodStartOf(week.from, 'week')).toBe(week.from);
    expect(week.from > from).toBe(true);

    // 2020-01-01 is a Wednesday; its Monday is before the API's first day.
    expect(
      alignRangeToPeriods({ from: MIN_ANALYTICS_DAY, to: '2020-03-01' }, 'week')
        .from,
    ).toBe('2020-01-06');
    // Every aligned range is one the API accepts.
    [month, week].forEach((range) =>
      expect(ok({ ...range, granularity: 'week' }).from).toBe(range.from),
    );
  });
});

describe('parseAnalyticsQuery', () => {
  it('defaults to the last 30 days, by day, top 10, ru, every visible widget', () => {
    expect(ok({})).toEqual({
      widgets: STAFF_IDS,
      from: '2026-10-30',
      to: TODAY,
      granularity: 'day',
      limit: 10,
      locale: 'ru',
    });
    expect(ok({}, true).widgets).toEqual(ALL_IDS);
  });

  it('never gives an ADMIN a superuser widget', () => {
    expect(visibleWidgetIds(false)).toEqual(STAFF_IDS);
    expect(STAFF_IDS).not.toContain('kpi_revenue');
    expect(
      ok({ widgets: 'kpi_revenue,revenue,kpi_aov,kpi_visitors' }).widgets,
    ).toEqual(['kpi_visitors']);
    expect(ok({ widgets: 'kpi_revenue' }).widgets).toEqual([]);
    expect(ok({ widgets: 'kpi_revenue,revenue' }, true).widgets).toEqual([
      'kpi_revenue',
      'revenue',
    ]);
  });

  it('returns requested widgets once each, in catalog order', () => {
    expect(
      ok({ widgets: ' top_products , kpi_visitors,top_products,traffic' })
        .widgets,
    ).toEqual(['kpi_visitors', 'traffic', 'top_products']);
  });

  it('treats an empty widgets list as the default', () => {
    expect(ok({ widgets: '' }).widgets).toEqual(STAFF_IDS);
    expect(ok({ widgets: ',' }).widgets).toEqual(STAFF_IDS);
  });

  it('rejects unknown widget ids', () => {
    expect(error({ widgets: 'kpi_visitors,nope' })).toMatch(/widget/i);
  });

  it('fills in a missing end or start of the range', () => {
    expect(ok({ from: '2026-11-01' })).toMatchObject({
      from: '2026-11-01',
      to: TODAY,
    });
    expect(ok({ to: '2026-06-30' })).toMatchObject({
      from: '2026-06-01',
      to: '2026-06-30',
    });
  });

  it('rejects bad days, from after to, and ranges over two years', () => {
    expect(error({ from: '2026-02-30' })).toMatch(/from/);
    expect(error({ to: 'yesterday' })).toMatch(/to/);
    expect(error({ from: '2026-11-10', to: '2026-11-09' })).toMatch(/after/);
    // A start after today, with the end defaulting to today.
    expect(error({ from: '2026-12-01' })).toMatch(/after/);

    const to = '2026-11-28';
    expect(ok({ from: shiftDay(to, -(MAX_RANGE_DAYS - 1)), to }).to).toBe(to);
    expect(error({ from: shiftDay(to, -MAX_RANGE_DAYS), to })).toMatch(/range/);
  });

  it('rejects days before 2020 and after tomorrow', () => {
    expect(MIN_ANALYTICS_DAY).toBe('2020-01-01');
    expect(maxAnalyticsDay(NOW)).toBe('2026-11-29');
    // Used to reach Postgres as year 1 and fail every KPI.
    expect(error({ from: '0001-01-01', to: '0001-12-31' })).toMatch(
      /^Invalid to: .*2020-01-01/,
    );
    expect(error({ from: '2019-12-31', to: '2020-01-10' })).toMatch(
      /^Invalid from: .*2020-01-01/,
    );
    expect(ok({ from: '2020-01-01', to: '2020-01-10' }).from).toBe(
      '2020-01-01',
    );
    expect(error({ to: '2026-11-30' })).toMatch(/^Invalid to: .*2026-11-29/);
    expect(error({ from: '9999-01-01', to: '9999-01-02' })).toMatch(
      /^Invalid to/,
    );
    expect(ok({ to: '2026-11-29' }).to).toBe('2026-11-29');
  });

  it('accepts a single day', () => {
    expect(ok({ from: '2026-11-05', to: '2026-11-05' })).toMatchObject({
      from: '2026-11-05',
      to: '2026-11-05',
    });
  });

  it('validates granularity', () => {
    expect(ok({ granularity: 'week' }).granularity).toBe('week');
    expect(ok({ granularity: 'month' }).granularity).toBe('month');
    expect(error({ granularity: 'year' })).toMatch(/granularity/);
  });

  it('validates limit', () => {
    expect(ok({ limit: '1' }).limit).toBe(1);
    expect(ok({ limit: '50' }).limit).toBe(50);
    expect(error({ limit: '51' })).toMatch(/limit/);
    expect(error({ limit: '0' })).toMatch(/limit/);
    expect(error({ limit: '2.5' })).toMatch(/limit/);
    expect(error({ limit: 'ten' })).toMatch(/limit/);
  });

  it('falls back to ru for an unknown locale', () => {
    expect(ok({ locale: 'tk' }).locale).toBe('tk');
    expect(ok({ locale: 'de' }).locale).toBe('ru');
  });

  it('uses the first value of a repeated parameter', () => {
    expect(
      ok({ granularity: ['month', 'day'], limit: ['5', '99'] }),
    ).toMatchObject({ granularity: 'month', limit: 5 });
  });
});

describe('PromiseCache', () => {
  let clock: number;
  const now = () => clock;

  beforeEach(() => {
    clock = 1_000;
  });

  it('serves a hit within the TTL and reloads after it', async () => {
    const cache = new PromiseCache<number>(60_000, 10, now);
    const load = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    expect(await cache.getOrLoad('k', load)).toBe(1);
    clock += 59_999;
    expect(await cache.getOrLoad('k', load)).toBe(1);
    clock += 1;
    expect(await cache.getOrLoad('k', load)).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shares one load between concurrent callers', async () => {
    const cache = new PromiseCache<number>(60_000, 10, now);
    let resolve: (value: number) => void = () => {};
    const load = vi.fn(
      () =>
        new Promise<number>((r) => {
          resolve = r;
        }),
    );
    const a = cache.getOrLoad('k', load);
    const b = cache.getOrLoad('k', load);
    resolve(7);
    expect(await Promise.all([a, b])).toEqual([7, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('forgets rejected loads and values that keep() turns down', async () => {
    const cache = new PromiseCache<number>(60_000, 10, now);
    const failing = vi.fn().mockRejectedValueOnce(new Error('x'));
    await expect(cache.getOrLoad('a', failing)).rejects.toThrow('x');
    expect(cache.size).toBe(0);

    const load = vi.fn().mockResolvedValue(0);
    await cache.getOrLoad('b', load, (value) => value > 0);
    await cache.getOrLoad('b', load, (value) => value > 0);
    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(0);
  });

  it('stays bounded, dropping the oldest entry first', async () => {
    const cache = new PromiseCache<string>(60_000, 3, now);
    await Promise.all(
      ['a', 'b', 'c', 'd'].map((key) => cache.getOrLoad(key, async () => key)),
    );
    expect(cache.size).toBe(3);
    const reload = vi.fn(async () => 'again');
    expect(await cache.getOrLoad('a', reload)).toBe('again');
    expect(await cache.getOrLoad('d', reload)).toBe('d');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('withTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves to the fallback when the promise is too slow', async () => {
    vi.useFakeTimers();
    const slow = new Promise<number>((resolve) => {
      setTimeout(() => resolve(5), 10_000);
    });
    const result = withTimeout(slow, 100, null);
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toBeNull();
  });

  it('passes a fast value through', async () => {
    expect(await withTimeout(Promise.resolve(5), 100, null)).toBe(5);
  });
});

describe('analyticsCacheKey', () => {
  const query: AnalyticsQuery = {
    widgets: ['kpi_visitors'],
    from: '2026-11-01',
    to: '2026-11-28',
    granularity: 'day',
    limit: 10,
    locale: 'ru',
  };

  it('differs by tier and by every query field', () => {
    const base = analyticsCacheKey(query, false);
    expect(analyticsCacheKey(query, true)).not.toBe(base);
    (
      [
        { widgets: ['traffic'] },
        { from: '2026-11-02' },
        { to: '2026-11-27' },
        { granularity: 'week' },
        { limit: 11 },
        { locale: 'en' },
      ] as Partial<AnalyticsQuery>[]
    ).forEach((change) => {
      expect(analyticsCacheKey({ ...query, ...change }, false)).not.toBe(base);
    });
    expect(analyticsCacheKey({ ...query }, false)).toBe(base);
  });
});

describe('getAnalytics', () => {
  const query: AnalyticsQuery = {
    widgets: ['kpi_visitors', 'traffic', 'top_products'],
    from: '2026-11-01',
    to: '2026-11-28',
    granularity: 'week',
    limit: 5,
    locale: 'en',
  };

  beforeEach(() => {
    clearAnalyticsCaches();
    vi.mocked(queryWidget).mockReset();
    vi.mocked(fetchTelekomBalance).mockReset().mockResolvedValue(1234);
    vi.mocked(dbClient.user.count)
      .mockReset()
      .mockResolvedValue(42 as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(console.error).mockRestore();
  });

  const kpi = { kind: 'kpi' as const, value: 3, previous: 1 };

  it('returns every widget in order with its catalog metadata', async () => {
    vi.mocked(queryWidget).mockImplementation(async (id) => {
      if (id === 'traffic') return { kind: 'timeseries', series: [] };
      if (id === 'top_products') return { kind: 'topN', rows: [] };
      return kpi;
    });

    const result = await getAnalytics(query, false);

    expect(result).toEqual({
      from: '2026-11-01',
      to: '2026-11-28',
      granularity: 'week',
      userCount: 42,
      telekomBalance: 1234,
      widgets: [
        {
          id: 'kpi_visitors',
          kind: 'kpi',
          unit: 'count',
          labelKey: 'analyticsVisitors',
          data: kpi,
        },
        {
          id: 'traffic',
          kind: 'timeseries',
          unit: 'count',
          labelKey: 'analyticsTraffic',
          data: { kind: 'timeseries', series: [] },
        },
        {
          id: 'top_products',
          kind: 'topN',
          unit: 'count',
          labelKey: 'analyticsTopProducts',
          data: { kind: 'topN', rows: [] },
        },
      ],
    });
    expect(queryWidget).toHaveBeenCalledWith(
      'traffic',
      {
        from: '2026-11-01',
        to: '2026-11-28',
        granularity: 'week',
        limit: 5,
        locale: 'en',
      },
      { ctx: { fake: 'ctx' } },
    );
  });

  it('shares one query context between the widgets of a request', async () => {
    vi.mocked(queryWidget).mockResolvedValue({
      kind: 'kpi',
      value: 1,
      previous: null,
    });
    await getAnalytics(
      { ...query, widgets: ['kpi_visitors', 'kpi_conversion'] },
      false,
    );
    const contexts = vi.mocked(queryWidget).mock.calls.map((call) => call[2]);
    expect(contexts).toHaveLength(2);
    expect(contexts[0]?.ctx).toBeDefined();
    expect(contexts[1]?.ctx).toBe(contexts[0]?.ctx);
  });

  it('turns a failed widget into data: null and keeps the rest', async () => {
    vi.mocked(queryWidget).mockImplementation(async (id) => {
      if (id === 'traffic') throw new Error('boom');
      return kpi;
    });

    const result = await getAnalytics(query, false);

    expect(result.widgets.map((w) => [w.id, w.data])).toEqual([
      ['kpi_visitors', kpi],
      ['traffic', null],
      ['top_products', kpi],
    ]);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('adminApi'),
      expect.stringContaining('traffic'),
      expect.any(Error),
    );
  });

  it('caches a full response per tier and query', async () => {
    vi.mocked(queryWidget).mockResolvedValue(kpi);

    await getAnalytics(query, false);
    await getAnalytics(query, false);
    expect(queryWidget).toHaveBeenCalledTimes(3);

    await getAnalytics(query, true);
    expect(queryWidget).toHaveBeenCalledTimes(6);

    await getAnalytics({ ...query, granularity: 'day' }, false);
    expect(queryWidget).toHaveBeenCalledTimes(9);
  });

  it("doesn't cache a response with a failed widget", async () => {
    vi.mocked(queryWidget)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(kpi);

    const first = await getAnalytics(query, false);
    expect(first.widgets[0].data).toBeNull();

    const second = await getAnalytics(query, false);
    expect(second.widgets[0].data).toEqual(kpi);
    expect(queryWidget).toHaveBeenCalledTimes(6);
  });

  it('reports null for a failed user count or Telekom balance', async () => {
    vi.mocked(queryWidget).mockResolvedValue(kpi);
    vi.mocked(dbClient.user.count).mockRejectedValue(new Error('db'));
    vi.mocked(fetchTelekomBalance).mockRejectedValue(new Error('telekom'));

    const result = await getAnalytics(query, false);

    expect(result.userCount).toBeNull();
    expect(result.telekomBalance).toBeNull();
    expect(result.widgets.every((w) => w.data != null)).toBe(true);
  });

  it("doesn't wait for a slow Telekom longer than the timeout", async () => {
    vi.useFakeTimers();
    vi.mocked(queryWidget).mockResolvedValue(kpi);
    vi.mocked(fetchTelekomBalance).mockReturnValue(new Promise(() => {}));

    const pending = getAnalytics(query, false);
    await vi.advanceTimersByTimeAsync(TELEKOM_TIMEOUT_MS);
    const result = await pending;

    expect(result.telekomBalance).toBeNull();
    expect(result.widgets).toHaveLength(3);
  });

  it('asks Telekom once for several queries', async () => {
    vi.mocked(queryWidget).mockResolvedValue(kpi);

    await getAnalytics(query, false);
    await getAnalytics({ ...query, granularity: 'month' }, false);
    await getAnalytics(query, true);

    expect(fetchTelekomBalance).toHaveBeenCalledTimes(1);
  });

  it('retries Telekom when it had no balance', async () => {
    vi.mocked(queryWidget).mockResolvedValue(kpi);
    vi.mocked(fetchTelekomBalance)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(99);

    expect((await getAnalytics(query, false)).telekomBalance).toBeNull();
    expect(
      (await getAnalytics({ ...query, limit: 6 }, false)).telekomBalance,
    ).toBe(99);
  });

  it('runs nothing for an empty widget list', async () => {
    const result = await getAnalytics({ ...query, widgets: [] }, false);
    expect(result.widgets).toEqual([]);
    expect(queryWidget).not.toHaveBeenCalled();
    expect(result.userCount).toBe(42);
  });
});
