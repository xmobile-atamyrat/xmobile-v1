import { describe, expect, it, vi } from 'vitest';

import {
  queryWidget,
  widgetQueries,
  type WidgetRegistry,
} from '@/lib/analytics/metrics';
import { WIDGETS } from '@/lib/analytics/metrics/catalog';
import { localizedName } from '@/lib/analytics/metrics/products';
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
