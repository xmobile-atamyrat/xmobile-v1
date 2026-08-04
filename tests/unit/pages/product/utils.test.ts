import { Color, Prices } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyPendingEdits,
  collectCategorySubtreeIds,
  computePrice,
  debounce,
  filterPricesByCategories,
  filterPricesWithoutCategory,
  filterPricesWithoutProduct,
  isPriceValid,
  parseOrderVariant,
  parsePrice,
  parseVariantTag,
  processPrices,
  resolveVariantDisplay,
} from '@/pages/product/utils';
import { ExtendedCategory } from '@/pages/lib/types';

describe('parsePrice', () => {
  it('rounds to two decimal places as a number', () => {
    expect(parsePrice('10.999')).toBe(11);
    expect(parsePrice('3.141')).toBe(3.14);
  });

  it('returns 0 for null-like input used at runtime', () => {
    expect(parsePrice(null as unknown as string)).toBe(0);
  });
});

describe('isPriceValid', () => {
  it('accepts integer and decimal strings', () => {
    expect(isPriceValid('0')).toBe(true);
    expect(isPriceValid('12')).toBe(true);
    expect(isPriceValid('12.5')).toBe(true);
  });

  it('rejects empty and non-numeric strings', () => {
    expect(isPriceValid('')).toBe(false);
    expect(isPriceValid('abc')).toBe(false);
    expect(isPriceValid('1a')).toBe(false);
  });
});

describe('processPrices', () => {
  it('builds header row and maps price fields', () => {
    const rows: Prices[] = [
      {
        id: 'p1',
        name: 'A',
        price: '10',
        priceInTmt: '35.50',
        categoryId: 'c1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Prices,
    ];
    const table = processPrices(rows);
    expect(table[0]).toEqual(['Name', 'Dollars', 'Manat', 'Category', 'ID']);
    expect(table[1]).toEqual(['A', '10', 35.5, 'c1', 'p1']);
  });

  it('emits a null category cell for an uncategorized price', () => {
    const table = processPrices([
      { id: 'p1', name: 'A', price: '10', priceInTmt: '35', categoryId: null },
    ] as Prices[]);
    expect(table[1]).toEqual(['A', '10', 35, null, 'p1']);
  });
});

describe('applyPendingEdits', () => {
  // [Name, Dollars, Manat, Category, ID]
  const table = [
    ['Name', 'Dollars', 'Manat', 'Category', 'ID'],
    ['A', '10', 200, 'c1', 'p1'],
    ['B', '20', 400, null, 'p2'],
  ];

  it('passes rows through unchanged when there are no edits', () => {
    expect(applyPendingEdits(table, {})).toEqual(table);
  });

  it('overlays an edit only onto the row with the matching price id', () => {
    const result = applyPendingEdits(table, {
      p2: { id: 'p2', name: 'B-edited', price: '25', priceInTmt: '500' },
    });
    // p1 untouched, p2 gets name/dollar/manat from the edit (manat parsed)
    expect(result[1]).toEqual(['A', '10', 200, 'c1', 'p1']);
    expect(result[2]).toEqual(['B-edited', '25', 500, null, 'p2']);
  });

  it('does not leak an edit onto a different price after re-ordering', () => {
    // p1 edited, then rows reordered (p2 now at the position p1 used to hold).
    const reordered = [table[0], table[2], table[1]];
    const result = applyPendingEdits(reordered, {
      p1: { id: 'p1', priceInTmt: '999' },
    });
    expect(result[1]).toEqual(['B', '20', 400, null, 'p2']); // p2 untouched
    expect(result[2]).toEqual(['A', '10', 999, 'c1', 'p1']); // edit follows p1
  });

  it('overlays a category assignment', () => {
    const result = applyPendingEdits(table, {
      p2: { id: 'p2', categoryId: 'c9' },
    });
    expect(result[2]).toEqual(['B', '20', 400, 'c9', 'p2']);
  });

  it('applies an explicit clear-to-null category edit', () => {
    // The distinguishing case: a null value must not be read as "untouched".
    const result = applyPendingEdits(table, {
      p1: { id: 'p1', categoryId: null },
    });
    expect(result[1]).toEqual(['A', '10', 200, null, 'p1']);
  });
});

describe('filterPricesWithoutProduct', () => {
  const prices = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] as Prices[];

  it('keeps prices absent from the map or mapped to no category', () => {
    const result = filterPricesWithoutProduct(prices, {
      p1: ['c1'],
      p2: [], // referenced by no product
      // p3 absent entirely
    });
    expect(result.map((p) => p.id)).toEqual(['p2', 'p3']);
  });

  it('returns all prices when the map is empty', () => {
    expect(filterPricesWithoutProduct(prices, {})).toEqual(prices);
  });
});

describe('filterPricesWithoutCategory', () => {
  it('keeps only prices with no category relation of their own', () => {
    const prices = [
      { id: 'p1', categoryId: 'c1' },
      { id: 'p2', categoryId: null },
      { id: 'p3', categoryId: null },
    ] as Prices[];
    expect(filterPricesWithoutCategory(prices).map((p) => p.id)).toEqual([
      'p2',
      'p3',
    ]);
  });
});

describe('filterPricesByCategories', () => {
  const prices = [
    { id: 'p1', categoryId: 'phones' },
    { id: 'p2', categoryId: 'smartphones' },
    { id: 'p3', categoryId: 'laptops' },
    { id: 'p4', categoryId: null },
  ] as Prices[];

  it('returns every price when no category ids are given', () => {
    expect(filterPricesByCategories(prices, new Set())).toEqual(prices);
  });

  it('matches on the price own categoryId, not on any product relation', () => {
    const result = filterPricesByCategories(prices, new Set(['laptops']));
    expect(result.map((p) => p.id)).toEqual(['p3']);
  });

  it('excludes prices with no category', () => {
    const result = filterPricesByCategories(
      prices,
      new Set(['phones', 'smartphones', 'laptops']),
    );
    expect(result.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('includes descendants when fed a category subtree', () => {
    const tree = [
      {
        id: 'phones',
        successorCategories: [{ id: 'smartphones' }],
      },
      { id: 'laptops' },
    ] as ExtendedCategory[];
    const subtree = collectCategorySubtreeIds(tree, 'phones');
    const result = filterPricesByCategories(prices, subtree);
    expect(result.map((p) => p.id)).toEqual(['p1', 'p2']);
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('invokes the function only after delay and collapses rapid calls', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);

    d(1);
    d(2);
    d(3);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });
});

// ── Variant tag parsing ──────────────────────────────────────────────────────

describe('parseVariantTag', () => {
  it('extracts specText, priceId, and colorId from a full tag', () => {
    const result = parseVariantTag('128gb storage 12gb ram [price-1]{color-1}');
    expect(result.specText).toBe('128gb storage 12gb ram');
    expect(result.priceId).toBe('price-1');
    expect(result.colorId).toBe('color-1');
  });

  it('extracts only priceId when there is no color ref', () => {
    const result = parseVariantTag('256gb [price-2]');
    expect(result.specText).toBe('256gb');
    expect(result.priceId).toBe('price-2');
    expect(result.colorId).toBeUndefined();
  });

  it('extracts only colorId when there is no price ref', () => {
    const result = parseVariantTag('blue {color-3}');
    expect(result.specText).toBe('blue');
    expect(result.priceId).toBeUndefined();
    expect(result.colorId).toBe('color-3');
  });

  it('returns the full text as specText when no refs are present', () => {
    const result = parseVariantTag('plain spec text');
    expect(result.specText).toBe('plain spec text');
    expect(result.priceId).toBeUndefined();
    expect(result.colorId).toBeUndefined();
  });

  it('returns empty specText and undefined refs for an empty string', () => {
    const result = parseVariantTag('');
    expect(result.specText).toBe('');
    expect(result.priceId).toBeUndefined();
    expect(result.colorId).toBeUndefined();
  });

  it('collapses whitespace left after stripping refs', () => {
    const result = parseVariantTag('  128gb  [price-1]  {color-1}  ');
    expect(result.specText).toBe('128gb');
  });
});

describe('resolveVariantDisplay', () => {
  function fakeColor(id: string, hex: string, name: string): Color {
    return {
      id,
      name,
      hex,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Color;
  }

  it('resolves spec, colorHex, and colorName when colorId is in the map', () => {
    const map = new Map([['c1', fakeColor('c1', '#ff0000', 'Red')]]);
    const result = resolveVariantDisplay('128gb [p1]{c1}', map);
    expect(result.spec).toBe('128gb');
    expect(result.colorHex).toBe('#ff0000');
    expect(result.colorName).toBe('Red');
  });

  it('returns undefined color fields when colorId is not in the map', () => {
    const result = resolveVariantDisplay('128gb [p1]{unknown}', new Map());
    expect(result.spec).toBe('128gb');
    expect(result.colorHex).toBeUndefined();
    expect(result.colorName).toBeUndefined();
  });

  it('returns undefined color fields when the tag has no color ref', () => {
    const map = new Map([['c1', fakeColor('c1', '#ff0000', 'Red')]]);
    const result = resolveVariantDisplay('128gb [p1]', map);
    expect(result.colorHex).toBeUndefined();
    expect(result.colorName).toBeUndefined();
  });
});

describe('parseOrderVariant', () => {
  it('parses a valid JSON snapshot with all fields', () => {
    const raw = JSON.stringify({
      spec: '128gb',
      colorHex: '#ff0000',
      colorName: 'Red',
    });
    const result = parseOrderVariant(raw);
    expect(result.spec).toBe('128gb');
    expect(result.colorHex).toBe('#ff0000');
    expect(result.colorName).toBe('Red');
  });

  it('converts null colorHex and colorName to undefined', () => {
    const raw = JSON.stringify({
      spec: '64gb',
      colorHex: null,
      colorName: null,
    });
    const result = parseOrderVariant(raw);
    expect(result.spec).toBe('64gb');
    expect(result.colorHex).toBeUndefined();
    expect(result.colorName).toBeUndefined();
  });

  it('falls back to plain-text spec for legacy non-JSON strings', () => {
    const result = parseOrderVariant('old plain spec');
    expect(result).toEqual({ spec: 'old plain spec' });
  });

  it('falls back to plain-text spec for malformed JSON', () => {
    const result = parseOrderVariant('{broken json');
    expect(result).toEqual({ spec: '{broken json' });
  });

  it('falls back to plain-text when JSON is valid but missing spec string', () => {
    const result = parseOrderVariant(JSON.stringify({ colorHex: '#fff' }));
    expect(result.spec).toBe(JSON.stringify({ colorHex: '#fff' }));
  });
});

describe('computePrice', () => {
  it('reflects a price edited between two reads instead of a stale cache', async () => {
    const tmtValues = ['2680', '1176000'];
    const fetchWithCreds = vi.fn(async () => ({
      success: true,
      data: { priceInTmt: tmtValues.shift() } as Prices,
    }));
    const args = {
      priceId: 'b087830c-7064-4eb3-9b01-c0f7d77781ab',
      accessToken: '',
      fetchWithCreds: fetchWithCreds as never,
    };

    expect(await computePrice(args)).toBe('2680');
    // a bulk upload changed the stored price in between
    expect(await computePrice(args)).toBe('1176000');
  });
});
