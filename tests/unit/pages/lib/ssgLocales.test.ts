import type { GetStaticPathsContext } from 'next';
import { describe, expect, it } from 'vitest';

import { expandDynamicPathsForAllLocales } from '@/pages/lib/ssgLocales';

describe('expandDynamicPathsForAllLocales', () => {
  it('uses context.locales when non-empty', () => {
    const context = {
      locales: ['en', 'ru'],
    } as GetStaticPathsContext;

    const paths = expandDynamicPathsForAllLocales(context, ['a', 'b']);

    expect(paths).toEqual([
      { params: { slug: 'a' }, locale: 'en' },
      { params: { slug: 'a' }, locale: 'ru' },
      { params: { slug: 'b' }, locale: 'en' },
      { params: { slug: 'b' }, locale: 'ru' },
    ]);
  });

  it('falls back to static locales when context.locales is missing or empty', () => {
    const missing = {} as GetStaticPathsContext;
    expect(
      expandDynamicPathsForAllLocales(missing, ['x'])
        .map((p) => p.locale)
        .sort(),
    ).toEqual(['ch', 'en', 'ru', 'tk', 'tr']);

    const empty = { locales: [] } as GetStaticPathsContext;
    const paths = expandDynamicPathsForAllLocales(empty, ['x']);
    expect(paths.map((p) => p.locale).sort()).toEqual([
      'ch',
      'en',
      'ru',
      'tk',
      'tr',
    ]);
    expect(paths.filter((p) => p.params.slug === 'x')).toHaveLength(5);
  });
});
