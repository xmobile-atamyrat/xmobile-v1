import { describe, expect, it, vi } from 'vitest';

import {
  createQueryContext,
  queryWidget,
  widgetQueries,
  type WidgetRegistry,
} from '@/lib/analytics/metrics';
import { WIDGETS } from '@/lib/analytics/metrics/catalog';
import { localizedName } from '@/lib/analytics/metrics/products';
import {
  memoize,
  visitorsUpperBound,
  type KpiRange,
  type StoredUniques,
} from '@/lib/analytics/metrics/sql';
import { kpi } from '@/lib/analytics/metrics/widget';
import { trafficWidgets } from '@/lib/analytics/metrics/traffic';
import { DAILY_ROLLUPS } from '@/lib/analytics/rollup';

vi.mock('@/lib/dbClient', () => ({ default: {} }));

describe('metric registry', () => {
  it('has a query for every catalog widget and nothing else', () => {
    expect(Object.keys(widgetQueries).sort()).toEqual(
      WIDGETS.map((w) => w.id).sort(),
    );
    WIDGETS.forEach((w) => expect(typeof widgetQueries[w.id]).toBe('function'));
  });

  it('makes a missing or wrong-kind widget query a type error', () => {
    // Checked by `yarn tsc --noEmit`: each @ts-expect-error must hold.
    // @ts-expect-error every catalog id needs an implementation
    const incomplete: WidgetRegistry = { ...trafficWidgets };
    const wrongKind: Pick<WidgetRegistry, 'kpi_visitors'> = {
      // @ts-expect-error a kpi widget must return kpi data
      kpi_visitors: async () => ({ kind: 'topN', rows: [] }),
    };
    expect(incomplete).toBeDefined();
    expect(wrongKind).toBeDefined();
  });

  it('rejects an unknown id', async () => {
    await expect(
      queryWidget('nope' as never, {
        from: '2026-11-01',
        to: '2026-11-02',
        granularity: 'day',
        limit: 10,
        locale: 'ru',
      }),
    ).rejects.toThrow('Unknown analytics widget');
  });

  it('writes each stored metric from exactly one rollup', () => {
    const metrics = DAILY_ROLLUPS.flatMap((r) => r.metrics);
    expect(new Set(metrics).size).toBe(metrics.length);
  });
});

describe('localizedName', () => {
  const name = JSON.stringify({ ru: 'Телефон', en: 'Phone', tk: 'Telefon' });

  it('picks the viewer locale', () => {
    expect(localizedName(name, 'en')).toBe('Phone');
    expect(localizedName(name, 'ru')).toBe('Телефон');
  });

  it('falls back like parseName (tk, ch, ru, en)', () => {
    expect(localizedName(name, 'tr')).toBe('Telefon');
    expect(localizedName(JSON.stringify({ en: 'Phone', tr: '' }), 'tr')).toBe(
      'Phone',
    );
  });

  it('returns plain names as they are', () => {
    expect(localizedName('iPhone 15', 'ru')).toBe('iPhone 15');
    expect(localizedName('42', 'ru')).toBe('42');
  });
});

describe('visitorsUpperBound', () => {
  // Mon 2026-11-02 .. Sun 11-08 and Mon 11-09 .. 11-15; November.
  const daily = (values: Record<string, number>) =>
    new Map(Object.entries(values));
  const stored = (over: Partial<StoredUniques> = {}): StoredUniques => ({
    daily: daily({
      '2026-10-31': 5,
      '2026-11-01': 5,
      '2026-11-02': 10,
      '2026-11-03': 10,
      '2026-11-09': 10,
    }),
    week: new Map(),
    month: new Map(),
    ...over,
  });

  it('is the daily sum without period rows', () => {
    expect(visitorsUpperBound('2026-11-02', '2026-11-09', stored())).toBe(30);
  });

  it('takes a week row where it is below the daily sum of its days', () => {
    const s = stored({ week: new Map([['2026-11-02', 12]]) });
    // 12 for the first week + 10 for the 9th.
    expect(visitorsUpperBound('2026-11-02', '2026-11-09', s)).toBe(22);
  });

  it('keeps the daily sum of a clipped period when it is smaller than the row', () => {
    // Only the 9th of the second week is in range: 10 < its row of 40.
    const s = stored({ week: new Map([['2026-11-09', 40]]) });
    expect(visitorsUpperBound('2026-11-02', '2026-11-09', s)).toBe(30);
  });

  it('takes the smaller of the week and month decompositions', () => {
    const s = stored({
      week: new Map([
        ['2026-10-26', 9],
        ['2026-11-02', 15],
      ]),
      month: new Map([
        ['2026-10-01', 4],
        ['2026-11-01', 25],
      ]),
    });
    // Weeks: min(10, 9) + min(20, 15) = 24; months: min(5, 4) + min(25, 25) = 29.
    expect(visitorsUpperBound('2026-10-31', '2026-11-03', s)).toBe(24);
  });
});

describe('kpi', () => {
  const NOW = new Date('2026-11-27T04:00:00Z'); // 09:00 in Ashgabat
  const params = (from: string, to: string) => ({
    from,
    to,
    granularity: 'day' as const,
    limit: 10,
    locale: 'ru',
    ctx: createQueryContext(NOW),
  });

  it('cuts both ranges at the same time of day when the range ends today', async () => {
    const ranges: KpiRange[] = [];
    await kpi(params('2026-11-21', '2026-11-27'), async (range) => {
      ranges.push(range);
      return 1;
    });
    expect(ranges).toEqual([
      { from: '2026-11-21', to: '2026-11-27', until: NOW },
      {
        from: '2026-11-14',
        to: '2026-11-20',
        until: new Date('2026-11-20T04:00:00Z'),
      },
    ]);
  });

  it('compares full days for a range that ended before today', async () => {
    const ranges: KpiRange[] = [];
    await kpi(params('2026-11-20', '2026-11-26'), async (range) => {
      ranges.push(range);
      return 1;
    });
    expect(ranges).toEqual([
      { from: '2026-11-20', to: '2026-11-26' },
      { from: '2026-11-13', to: '2026-11-19' },
    ]);
  });

  it('has no previous value when only one side is an upper bound', async () => {
    const result = (exactNow: boolean, exactBefore: boolean) =>
      kpi(params('2026-11-20', '2026-11-26'), async ({ from }) =>
        from === '2026-11-20'
          ? { value: 10, exact: exactNow }
          : { value: 8, exact: exactBefore },
      );
    expect(await result(true, false)).toEqual({
      kind: 'kpi',
      value: 10,
      previous: null,
    });
    expect(await result(false, true)).toMatchObject({ previous: null });
    expect(await result(false, false)).toMatchObject({ previous: 8 });
    expect(await result(true, true)).toMatchObject({ previous: 8 });
  });

  it('reports an undefined current value as 0 and keeps a null previous', async () => {
    expect(
      await kpi(params('2026-11-20', '2026-11-26'), async () => null),
    ).toEqual({ kind: 'kpi', value: 0, previous: null });
  });
});

describe('memoize', () => {
  it('runs a load once per context and key', async () => {
    const ctx = createQueryContext(new Date('2026-11-27T04:00:00Z'));
    let runs = 0;
    const load = async () => {
      runs += 1;
      return runs;
    };
    const until = new Date('2026-11-27T04:00:00Z');
    expect(await memoize(ctx, ['a', '2026-11-01', until], load)).toBe(1);
    expect(await memoize(ctx, ['a', '2026-11-01', until], load)).toBe(1);
    expect(await memoize(ctx, ['a', '2026-11-02', until], load)).toBe(2);
    expect(
      await memoize(createQueryContext(), ['a', '2026-11-01', until], load),
    ).toBe(3);
  });
});
