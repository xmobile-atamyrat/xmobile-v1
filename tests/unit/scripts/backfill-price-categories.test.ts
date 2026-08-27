import { describe, expect, test } from 'vitest';

import { derivePriceCategories } from '../../../scripts/backfill-price-categories';

const PHONES = 'cat-phones';
const TABLETS = 'cat-tablets';

describe('derivePriceCategories', () => {
  test('resolves a price referenced by a product price field', () => {
    const { resolved } = derivePriceCategories([
      { price: '[price-1]', tags: [], categoryId: PHONES },
    ]);

    expect(resolved.get('price-1')).toBe(PHONES);
  });

  test('resolves a price referenced by a variant tag carrying a color', () => {
    const { resolved } = derivePriceCategories([
      {
        price: null,
        tags: ['128gb storage 12gb ram [price-2]{color-9}'],
        categoryId: TABLETS,
      },
    ]);

    expect(resolved.get('price-2')).toBe(TABLETS);
  });

  test('resolves once when several products of one category share a price', () => {
    const { resolved, ambiguous } = derivePriceCategories([
      { price: '[price-3]', tags: [], categoryId: PHONES },
      { price: null, tags: ['64gb [price-3]'], categoryId: PHONES },
    ]);

    expect(resolved.get('price-3')).toBe(PHONES);
    expect(ambiguous.size).toBe(0);
  });

  test('marks a price ambiguous when products of two categories reference it', () => {
    const { resolved, ambiguous } = derivePriceCategories([
      { price: '[price-4]', tags: [], categoryId: PHONES },
      { price: '[price-4]', tags: [], categoryId: TABLETS },
    ]);

    expect(resolved.has('price-4')).toBe(false);
    expect([...(ambiguous.get('price-4') ?? [])].sort()).toEqual(
      [PHONES, TABLETS].sort(),
    );
  });

  test('ignores products without a price and tags without a price id', () => {
    const { resolved, ambiguous } = derivePriceCategories([
      { price: null, tags: ['red', '128gb storage'], categoryId: PHONES },
      { price: '', tags: [], categoryId: PHONES },
    ]);

    expect(resolved.size).toBe(0);
    expect(ambiguous.size).toBe(0);
  });
});
