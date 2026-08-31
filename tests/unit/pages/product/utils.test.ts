import { Color, Prices } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyPendingEdits,
  collectCategorySubtreeIds,
  computePrice,
  computeProductPrice,
  computeProductPriceTags,
  debounce,
  filterPricesByCategories,
  filterPricesOutOfStock,
  filterPricesWithoutCategory,
  filterPricesWithoutProduct,
  isEditablePriceCell,
  isPriceValid,
  parseOrderVariant,
  parsePrice,
  parseVariantTag,
  pickVariantColorForSpec,
  PRICE_CATEGORY_IDX,
  PRICE_DOLLAR_IDX,
  PRICE_ID_IDX,
  PRICE_MANAT_IDX,
  PRICE_NAME_IDX,
  PRICE_OUT_OF_STOCK_IDX,
  PRICE_UPDATED_IDX,
  processPrices,
  resolveVariantDisplay,
  tmtFromUsd,
} from '@/pages/product/utils';
import { Product } from '@prisma/client';
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

describe('tmtFromUsd', () => {
  it('rounds a fractional manat amount up to the next whole manat', () => {
    expect(tmtFromUsd(18.88, 19.6)).toBe(371); // 370.048
  });

  it('does not add a manat when the product is only above a whole number by float error', () => {
    // 50 * 19.6 === 980.0000000000001 in IEEE-754
    expect(tmtFromUsd(50, 19.6)).toBe(980);
    // 100 * 19.6 === 1960.0000000000002
    expect(tmtFromUsd(100, 19.6)).toBe(1960);
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
        productId: 'prod-1',
        isOutOfStock: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-02-03T04:05:06.000Z'),
      } as Prices,
    ];
    const table = processPrices(rows);
    expect(table[0]).toEqual([
      'Name',
      'Dollars',
      'Manat',
      'Category',
      'Out of stock',
      'Updated',
    ]);
    expect(table[1]).toEqual([
      'A',
      '10',
      35.5,
      'c1',
      false,
      '2026-02-03T04:05:06.000Z',
      'p1',
    ]);
  });

  it('carries the id past the last rendered column', () => {
    // The table draws `row.slice(0, PRICE_ID_IDX)`, so the header is one cell
    // shorter than a data row on purpose: the id rides along as the edit key
    // without ever being drawn.
    const table = processPrices([
      { id: 'p1', name: 'A', price: '10', priceInTmt: '35' },
    ] as Prices[]);
    expect(table[0]).toHaveLength(PRICE_ID_IDX);
    expect(table[1][PRICE_ID_IDX]).toBe('p1');
    expect(table[1].slice(0, PRICE_ID_IDX)).not.toContain('p1');
  });

  it('emits a null category cell for an uncategorized price', () => {
    const table = processPrices([
      {
        id: 'p1',
        name: 'A',
        price: '10',
        priceInTmt: '35',
        categoryId: null,
        productId: null,
        isOutOfStock: true,
        updatedAt: new Date('2026-02-03T04:05:06.000Z'),
      },
    ] as Prices[]);
    expect(table[1]).toEqual([
      'A',
      '10',
      35,
      null,
      true,
      '2026-02-03T04:05:06.000Z',
      'p1',
    ]);
  });

  it('emits a null updated cell rather than an invalid date', () => {
    const table = processPrices([
      { id: 'p1', name: 'A', price: '10', priceInTmt: '35' },
    ] as Prices[]);
    expect(table[1][PRICE_UPDATED_IDX]).toBeNull();
  });
});

describe('applyPendingEdits', () => {
  // [Name, Dollars, Manat, Category, Out of stock, Updated, ID]
  const updated = '2026-02-03T04:05:06.000Z';
  const table = [
    ['Name', 'Dollars', 'Manat', 'Category', 'Out of stock', 'Updated'],
    ['A', '10', 200, 'c1', false, updated, 'p1'],
    ['B', '20', 400, null, false, updated, 'p2'],
  ];

  it('passes rows through unchanged when there are no edits', () => {
    expect(applyPendingEdits(table, {})).toEqual(table);
  });

  it('overlays an edit only onto the row with the matching price id', () => {
    const result = applyPendingEdits(table, {
      p2: { id: 'p2', name: 'B-edited', price: '25', priceInTmt: '500' },
    });
    // p1 untouched, p2 gets name/dollar/manat from the edit (manat parsed)
    expect(result[1]).toEqual(['A', '10', 200, 'c1', false, updated, 'p1']);
    expect(result[2]).toEqual([
      'B-edited',
      '25',
      500,
      null,
      false,
      updated,
      'p2',
    ]);
  });

  it('does not leak an edit onto a different price after re-ordering', () => {
    // p1 edited, then rows reordered (p2 now at the position p1 used to hold).
    const reordered = [table[0], table[2], table[1]];
    const result = applyPendingEdits(reordered, {
      p1: { id: 'p1', priceInTmt: '999' },
    });
    // p2 untouched
    expect(result[1]).toEqual(['B', '20', 400, null, false, updated, 'p2']);
    // follows p1
    expect(result[2]).toEqual(['A', '10', 999, 'c1', false, updated, 'p1']);
  });

  it('overlays a category assignment', () => {
    const result = applyPendingEdits(table, {
      p2: { id: 'p2', categoryId: 'c9' },
    });
    expect(result[2]).toEqual(['B', '20', 400, 'c9', false, updated, 'p2']);
  });

  it('applies an explicit clear-to-null category edit', () => {
    // The distinguishing case: a null value must not be read as "untouched".
    const result = applyPendingEdits(table, {
      p1: { id: 'p1', categoryId: null },
    });
    expect(result[1]).toEqual(['A', '10', 200, null, false, updated, 'p1']);
  });

  it('overlays an out-of-stock edit', () => {
    const result = applyPendingEdits(table, {
      p2: { id: 'p2', isOutOfStock: true },
    });
    expect(result[2]).toEqual(['B', '20', 400, null, true, updated, 'p2']);
  });

  it('applies an explicit back-in-stock edit', () => {
    // Same presence-keyed distinction as category: `false` is an edit, not an
    // absent field.
    const outOfStockTable = [
      table[0],
      ['A', '10', 200, 'c1', true, updated, 'p1'],
      table[2],
    ];
    const result = applyPendingEdits(outOfStockTable, {
      p1: { id: 'p1', isOutOfStock: false },
    });
    expect(result[1]).toEqual(['A', '10', 200, 'c1', false, updated, 'p1']);
  });

  it('ignores a productId edit now that the table has no product column', () => {
    const result = applyPendingEdits(table, {
      p1: { id: 'p1', productId: 'prod-9' },
    });
    expect(result[1]).toEqual(table[1]);
  });
});

describe('filterPricesOutOfStock', () => {
  it('keeps only the prices marked sold out', () => {
    const prices = [
      { id: 'p1', isOutOfStock: true },
      { id: 'p2', isOutOfStock: false },
      { id: 'p3', isOutOfStock: true },
    ] as Prices[];
    expect(filterPricesOutOfStock(prices).map((p) => p.id)).toEqual([
      'p1',
      'p3',
    ]);
  });

  it('returns an empty list when everything is in stock', () => {
    expect(
      filterPricesOutOfStock([{ id: 'p1', isOutOfStock: false }] as Prices[]),
    ).toEqual([]);
  });
});

describe('filterPricesWithoutProduct', () => {
  it('keeps only prices no product owns', () => {
    const prices = [
      { id: 'p1', productId: 'prod-1' },
      { id: 'p2', productId: null },
      { id: 'p3', productId: null },
    ] as Prices[];

    const result = filterPricesWithoutProduct(prices);
    expect(result.map((p) => p.id)).toEqual(['p2', 'p3']);
  });

  it('returns all prices when none are connected', () => {
    const prices = [
      { id: 'p1', productId: null },
      { id: 'p2', productId: null },
    ] as Prices[];

    expect(filterPricesWithoutProduct(prices)).toEqual(prices);
  });

  it('returns nothing when every price is connected', () => {
    const prices = [
      { id: 'p1', productId: 'prod-1' },
      { id: 'p2', productId: 'prod-2' },
    ] as Prices[];

    expect(filterPricesWithoutProduct(prices)).toEqual([]);
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

  it('returns null instead of echoing the id back when the price is gone', async () => {
    // The old fallback returned the id, which is what put a raw uuid on the
    // product card once a price row was deleted.
    const fetchWithCreds = vi.fn(async () => ({ success: true, data: null }));

    expect(
      await computePrice({
        priceId: 'deleted-price',
        accessToken: '',
        fetchWithCreds: fetchWithCreds as never,
      }),
    ).toBeNull();
  });
});

// Serves a price row per id, standing in for GET /api/prices?id=... An id with
// no entry answers the way the API does for a deleted price: success, no data.
const priceFetcher = (rows: Record<string, Partial<Prices>>) =>
  vi.fn(async ({ path }: { path: string }) => ({
    success: true,
    data: (rows[path.split('id=')[1]] ?? null) as Prices,
  }));

const productWith = (fields: Partial<Product>): Product =>
  ({
    id: 'prod-1',
    price: null,
    tags: [],
    isOutOfStock: false,
    ...fields,
  }) as Product;

describe('computeProductPrice', () => {
  it('prefers the inline {value} and never fetches', async () => {
    const fetchWithCreds = priceFetcher({});
    const result = await computeProductPrice({
      product: productWith({ price: '[p1]{350}' }),
      accessToken: '',
      fetchWithCreds: fetchWithCreds as never,
    });

    expect(result.price).toBe('350');
    expect(fetchWithCreds).not.toHaveBeenCalled();
  });

  it('resolves a bare [priceId] base reference', async () => {
    const result = await computeProductPrice({
      product: productWith({ price: '[p1]' }),
      accessToken: '',
      fetchWithCreds: priceFetcher({
        p1: { priceInTmt: '350', isOutOfStock: false },
      }) as never,
    });

    expect(result.price).toBe('350');
    expect(result.isOutOfStock).toBe(false);
  });

  it('falls back to the cheapest sellable variant when the base reference dangles', async () => {
    const result = await computeProductPrice({
      product: productWith({
        price: '[deleted]',
        tags: ['256gb [p2]{c1}', '128gb [p3]{c1}'],
      }),
      accessToken: '',
      fetchWithCreds: priceFetcher({
        p2: { priceInTmt: '900', isOutOfStock: false },
        p3: { priceInTmt: '700', isOutOfStock: false },
      }) as never,
    });

    expect(result.price).toBe('700');
    expect(result.isOutOfStock).toBe(false);
  });

  it('does not advertise a sold-out variant as the fallback price', async () => {
    const result = await computeProductPrice({
      product: productWith({
        price: '[deleted]',
        tags: ['256gb [p2]{c1}', '128gb [p3]{c1}'],
      }),
      accessToken: '',
      fetchWithCreds: priceFetcher({
        // The cheaper one cannot be bought, so the dearer one is the real price.
        p2: { priceInTmt: '900', isOutOfStock: false },
        p3: { priceInTmt: '700', isOutOfStock: true },
      }) as never,
    });

    expect(result.price).toBe('900');
  });

  it('marks the product out of stock when no reference resolves at all', async () => {
    const result = await computeProductPrice({
      product: productWith({ price: '[deleted]', tags: ['128gb [gone]{c1}'] }),
      accessToken: '',
      fetchWithCreds: priceFetcher({}) as never,
    });

    expect(result.price).toBe('');
    expect(result.isOutOfStock).toBe(true);
  });

  it('leaves a legacy literal price untouched', async () => {
    const fetchWithCreds = priceFetcher({});
    const result = await computeProductPrice({
      product: productWith({ price: '1200' }),
      accessToken: '',
      fetchWithCreds: fetchWithCreds as never,
    });

    expect(result.price).toBe('1200');
    expect(result.isOutOfStock).toBe(false);
    expect(fetchWithCreds).not.toHaveBeenCalled();
  });
});

describe('computeProductPriceTags', () => {
  it('substitutes the resolved price into each variant tag', async () => {
    const result = await computeProductPriceTags({
      product: productWith({ price: '[p1]{350}', tags: ['128gb [p2]{c1}'] }),
      accessToken: '',
      fetchWithCreds: priceFetcher({ p2: { priceInTmt: '700' } }) as never,
    });

    expect(result.tags).toEqual(['128gb 700{c1}']);
  });

  it('strips an unresolvable reference rather than showing the raw id', async () => {
    const result = await computeProductPriceTags({
      product: productWith({ price: '[p1]{350}', tags: ['128gb [gone]{c1}'] }),
      accessToken: '',
      fetchWithCreds: priceFetcher({}) as never,
    });

    expect(result.tags).toEqual(['128gb {c1}']);
    expect(result.tags[0]).not.toContain('gone');
  });
});

describe('pickVariantColorForSpec', () => {
  const v = (specText: string, colorId: string, isOutOfStock = false) => ({
    specText,
    colorId,
    isOutOfStock,
  });

  it('keeps the current colour when the new spec still sells it', () => {
    const variants = [v('128gb', 'red'), v('256gb', 'red'), v('256gb', 'blue')];

    expect(pickVariantColorForSpec(variants, '256gb', 'red')).toBe('red');
  });

  it('re-picks when the new spec never had the current colour', () => {
    const variants = [v('128gb', 'red'), v('256gb', 'blue')];

    expect(pickVariantColorForSpec(variants, '256gb', 'red')).toBe('blue');
  });

  // The bug this guards: the colour exists for the new spec but that exact
  // combination is sold out, so the page showed an out-of-stock pill while a
  // different colour of the same spec was sitting there buyable.
  it('re-picks when the current colour is sold out for the new spec', () => {
    const variants = [
      v('128gb', 'red'),
      v('256gb', 'red', true),
      v('256gb', 'blue'),
    ];

    expect(pickVariantColorForSpec(variants, '256gb', 'red')).toBe('blue');
  });

  it('keeps the sold-out colour when every colour of the spec is sold out', () => {
    const variants = [v('256gb', 'red', true), v('256gb', 'blue', true)];

    expect(pickVariantColorForSpec(variants, '256gb', 'red')).toBe('red');
  });

  it('falls back to the first colour of the spec when nothing is selected', () => {
    const variants = [v('256gb', 'red', true), v('256gb', 'blue', true)];

    expect(pickVariantColorForSpec(variants, '256gb', undefined)).toBe('red');
  });

  it('returns undefined for a spec with no variants', () => {
    expect(pickVariantColorForSpec([v('128gb', 'red')], '512gb', 'red')).toBe(
      undefined,
    );
  });
});

describe('isEditablePriceCell', () => {
  it('accepts the three text columns the admin types into', () => {
    expect(isEditablePriceCell(PRICE_NAME_IDX)).toBe(true);
    expect(isEditablePriceCell(PRICE_DOLLAR_IDX)).toBe(true);
    expect(isEditablePriceCell(PRICE_MANAT_IDX)).toBe(true);
  });

  // The out-of-stock cell holds a real checkbox whose native input event
  // bubbles to the row's text-edit handler. Treating it as editable submitted
  // an empty value: an invalidPrice error on every toggle, and — because the
  // handler is one shared debounce — a price typed moments earlier was dropped.
  it('rejects the widget columns that only bubble their own events', () => {
    expect(isEditablePriceCell(PRICE_CATEGORY_IDX)).toBe(false);
    expect(isEditablePriceCell(PRICE_OUT_OF_STOCK_IDX)).toBe(false);
    expect(isEditablePriceCell(PRICE_UPDATED_IDX)).toBe(false);
  });
});
