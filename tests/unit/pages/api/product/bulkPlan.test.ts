import { describe, expect, it } from 'vitest';

import {
  buildProductDiff,
  CurrentProductState,
  DiffLookups,
  ImportProductRow,
  ImportVariantRow,
  PlanRefs,
  planProductUpdate,
} from '@/pages/api/product/bulk.page';

const productRow = (
  over: Partial<ImportProductRow> = {},
): ImportProductRow => ({
  row: 2,
  id: 'p1',
  ...over,
});

const variantRow = (
  over: Partial<ImportVariantRow> = {},
): ImportVariantRow => ({
  row: 2,
  productId: 'p1',
  ...over,
});

const makeRefs = (over: Partial<PlanRefs> = {}): PlanRefs => ({
  categoryIdBySlug: new Map([['phones', 'cat1']]),
  brandIdByLowerName: new Map([['apple', 'brand1']]),
  colorIdByLowerName: new Map([
    ['black', 'col1'],
    ['white', 'col2'],
  ]),
  priceById: new Map(),
  rate: 20,
  ...over,
});

const makeCurrent = (
  over: Partial<CurrentProductState> = {},
): CurrentProductState => ({
  name: JSON.stringify({ en: 'iPhone 15', ru: 'Айфон 15' }),
  price: '[bp1]',
  tags: ['128gb [vp1]{col1}', '256gb [vp2]'],
  brandId: null,
  categoryId: 'cat0',
  isOutOfStock: false,
  videoUrls: [],
  ...over,
});

describe('planProductUpdate variants', () => {
  it('keeps a matched variant untouched when its cells are empty', () => {
    const plan = planProductUpdate(
      productRow(),
      [variantRow({ spec: '128gb', color: 'Black' })],
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.errors).toEqual([]);
    expect(plan.tags).toEqual([
      { spec: '128gb', colorId: 'col1', priceId: 'vp1', price: undefined },
    ]);
  });

  it('updates a matched variant price in place', () => {
    const plan = planProductUpdate(
      productRow(),
      [variantRow({ spec: '128gb', priceUsd: '100', color: 'White' })],
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.tags).toEqual([
      {
        spec: '128gb',
        colorId: 'col2',
        priceId: 'vp1',
        price: { name: '128gb White', usd: '100', tmt: '2000' },
      },
    ]);
  });

  it('creates a price for a new spec, named "<en name> <spec>"', () => {
    const plan = planProductUpdate(
      productRow(),
      [variantRow({ spec: '512gb', priceUsd: '200' })],
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.tags).toEqual([
      {
        spec: '512gb',
        colorId: undefined,
        priceId: undefined,
        price: { name: '512gb', usd: '200', tmt: '4000' },
      },
    ]);
  });

  it('drops variants absent from the sheet', () => {
    const plan = planProductUpdate(
      productRow(),
      [variantRow({ spec: '128gb' })],
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.tags).toHaveLength(1);
    expect(plan.tags?.[0].spec).toBe('128gb');
  });

  it('normalizes whitespace when matching specs', () => {
    const plan = planProductUpdate(
      productRow(),
      [variantRow({ spec: '  128gb   ' })],
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.tags?.[0].priceId).toBe('vp1');
  });

  it('rejects the whole product on duplicate specs', () => {
    const plan = planProductUpdate(
      productRow(),
      [variantRow({ spec: '128gb' }), variantRow({ row: 3, spec: '128gb' })],
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.errors).toEqual([
      { sheet: 'Variants', row: 3, message: 'duplicate variant spec "128gb"' },
    ]);
    expect(plan.data).toBeUndefined();
    expect(plan.tags).toBeUndefined();
  });

  it('accepts the same spec with different colors', () => {
    const plan = planProductUpdate(
      productRow(),
      [
        variantRow({ spec: '128gb', color: 'Black' }),
        variantRow({ row: 3, spec: '128gb', color: 'White' }),
      ],
      makeCurrent({ tags: ['128gb [vp1]{col1}', '128gb [vp3]{col2}'] }),
      makeRefs(),
    );
    expect(plan.errors).toEqual([]);
    expect(plan.tags).toEqual([
      { spec: '128gb', colorId: 'col1', priceId: 'vp1', price: undefined },
      { spec: '128gb', colorId: 'col2', priceId: 'vp3', price: undefined },
    ]);
  });

  it('rejects the same spec repeated with the same color', () => {
    const plan = planProductUpdate(
      productRow(),
      [
        variantRow({ spec: '128gb', color: 'Black' }),
        variantRow({ row: 3, spec: '128gb', color: 'Black' }),
      ],
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.errors).toEqual([
      {
        sheet: 'Variants',
        row: 3,
        message: 'duplicate variant spec "128gb" with color "Black"',
      },
    ]);
  });

  it('round-trips a colorless variant', () => {
    const plan = planProductUpdate(
      productRow(),
      [variantRow({ spec: '256gb', color: '' })],
      makeCurrent({ tags: ['256gb [vp2]'] }),
      makeRefs(),
    );
    expect(plan.errors).toEqual([]);
    expect(plan.tags).toEqual([
      { spec: '256gb', colorId: undefined, priceId: 'vp2', price: undefined },
    ]);
  });

  it('leaves tags untouched when the Variants sheet is missing', () => {
    const plan = planProductUpdate(
      productRow(),
      undefined,
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.errors).toEqual([]);
    expect(plan.tags).toBeUndefined();
  });

  it('clears all tags when the sheet is present with zero rows', () => {
    const plan = planProductUpdate(productRow(), [], makeCurrent(), makeRefs());
    expect(plan.tags).toEqual([]);
  });
});

describe('planProductUpdate reference lookups', () => {
  it('rejects unknown category slug', () => {
    const plan = planProductUpdate(
      productRow({ categorySlug: 'nope' }),
      undefined,
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.errors).toEqual([
      { sheet: 'Products', row: 2, message: 'unknown category slug "nope"' },
    ]);
    expect(plan.data).toBeUndefined();
  });

  it('rejects unknown brand', () => {
    const plan = planProductUpdate(
      productRow({ brand: 'Nokia' }),
      undefined,
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.errors[0].message).toBe('unknown brand "Nokia"');
  });

  it('rejects the whole product on unknown variant color, even with valid product edits', () => {
    const plan = planProductUpdate(
      productRow({ brand: 'Apple' }),
      [variantRow({ spec: '128gb', color: 'Chartreuse' })],
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.errors).toEqual([
      { sheet: 'Variants', row: 2, message: 'unknown color "Chartreuse"' },
    ]);
    expect(plan.data).toBeUndefined();
  });

  it('resolves category, brand and color case-insensitively', () => {
    const plan = planProductUpdate(
      productRow({ categorySlug: 'Phones', brand: 'APPLE' }),
      [variantRow({ spec: '128gb', color: 'bLaCk' })],
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.errors).toEqual([]);
    expect(plan.data?.categoryId).toBe('cat1');
    expect(plan.data?.brandId).toBe('brand1');
    expect(plan.tags?.[0].colorId).toBe('col1');
  });
});

describe('planProductUpdate prices', () => {
  it('converts USD-only to TMT with Math.ceil(usd * rate)', () => {
    const plan = planProductUpdate(
      productRow({ priceUsd: '1,000' }),
      undefined,
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.basePrice).toEqual({
      priceId: 'bp1',
      name: 'iPhone 15',
      usd: '1000',
      tmt: '20000',
    });
    expect(plan.data?.cachedPrice).toBe(1000);
  });

  it('converts TMT-only to USD with parsePrice(tmt / rate)', () => {
    const plan = planProductUpdate(
      productRow({ priceTmt: '2470' }),
      undefined,
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.basePrice?.usd).toBe('123.5');
    expect(plan.basePrice?.tmt).toBe('2470');
  });

  it('takes both values as-is when both are given', () => {
    const plan = planProductUpdate(
      productRow({ priceUsd: '100', priceTmt: '1999' }),
      undefined,
      makeCurrent(),
      makeRefs({ rate: null }),
    );
    expect(plan.errors).toEqual([]);
    expect(plan.basePrice?.usd).toBe('100');
    expect(plan.basePrice?.tmt).toBe('1999');
  });

  it('errors when conversion is needed but the rate is missing', () => {
    const plan = planProductUpdate(
      productRow({ priceUsd: '100' }),
      undefined,
      makeCurrent(),
      makeRefs({ rate: null }),
    );
    expect(plan.errors[0].message).toContain('dollar rate not found');
  });

  it('resolves a raw-id (non-bracket) base price ref', () => {
    const plan = planProductUpdate(
      productRow({ priceUsd: '50' }),
      undefined,
      makeCurrent({ price: 'raw-price-id' }),
      makeRefs(),
    );
    expect(plan.basePrice?.priceId).toBe('raw-price-id');
  });

  it('plans a Prices create when the product has no price ref', () => {
    const plan = planProductUpdate(
      productRow({ priceUsd: '50' }),
      undefined,
      makeCurrent({ price: null }),
      makeRefs(),
    );
    expect(plan.basePrice?.priceId).toBeUndefined();
    expect(plan.basePrice?.name).toBe('iPhone 15');
    expect(plan.data?.cachedPrice).toBe(50);
  });
});

describe('planProductUpdate empty cells and booleans', () => {
  it('treats all-empty cells as a no-op', () => {
    const plan = planProductUpdate(
      productRow(),
      undefined,
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.errors).toEqual([]);
    expect(plan.data).toEqual({});
    expect(plan.basePrice).toBeUndefined();
    expect(plan.tags).toBeUndefined();
  });

  it.each([
    ['TRUE', true],
    ['Yes', true],
    ['1', true],
    ['FALSE', false],
    ['no', false],
    ['0', false],
  ])('parses Out of Stock %s as %s', (raw, expected) => {
    const plan = planProductUpdate(
      productRow({ outOfStock: raw }),
      undefined,
      makeCurrent({ isOutOfStock: !expected }), // differ so the value is emitted
      makeRefs(),
    );
    expect(plan.data?.isOutOfStock).toBe(expected);
  });

  it('rejects an unparseable Out of Stock value', () => {
    const plan = planProductUpdate(
      productRow({ outOfStock: 'maybe' }),
      undefined,
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.errors[0].message).toContain('invalid Out of Stock value');
  });

  it('splits Video URLs on the pipe separator', () => {
    const plan = planProductUpdate(
      productRow({ videoUrls: 'https://a.mp4 | https://b.mp4' }),
      undefined,
      makeCurrent(),
      makeRefs(),
    );
    expect(plan.data?.videoUrls).toEqual(['https://a.mp4', 'https://b.mp4']);
  });
});

const makeLookups = (over: Partial<DiffLookups> = {}): DiffLookups => ({
  categorySlugById: new Map([
    ['cat0', 'laptops'],
    ['cat1', 'phones'],
  ]),
  brandNameById: new Map([['brand1', 'Apple']]),
  colorNameById: new Map([
    ['col1', 'Black'],
    ['col2', 'White'],
  ]),
  priceById: new Map([
    ['bp1', { usd: '100', tmt: '2000' }],
    ['vp1', { usd: '50', tmt: '1000' }],
    ['vp2', { usd: '80', tmt: '1600' }],
  ]),
  ...over,
});

// buildProductDiff runs on the output of planProductUpdate, so drive it through
// the planner to exercise the real before->after wiring.
const diffFor = (
  productOver: Partial<ImportProductRow>,
  variants: ImportVariantRow[] | undefined,
  currentOver: Partial<CurrentProductState> = {},
) => {
  const plan = planProductUpdate(
    productRow(productOver),
    variants,
    makeCurrent(currentOver),
    makeRefs(),
  );
  return buildProductDiff(makeCurrent(currentOver), plan, makeLookups());
};

describe('buildProductDiff', () => {
  it('returns null when the plan touches nothing', () => {
    expect(diffFor({}, undefined)).toBeNull();
  });

  it('describes a category change as slug from -> to', () => {
    const diff = diffFor({ categorySlug: 'phones' }, undefined);
    expect(diff?.fields).toContainEqual({
      label: 'Category',
      from: 'laptops',
      to: 'phones',
    });
  });

  it('describes a base price change as "usd / tmt"', () => {
    const diff = diffFor({ priceUsd: '120' }, undefined);
    expect(diff?.fields).toContainEqual({
      label: 'Price',
      from: '100 / 2000',
      to: '120 / 2400',
    });
  });

  it('flags an added variant', () => {
    const diff = diffFor({}, [
      variantRow({ spec: '128gb', color: 'Black' }),
      variantRow({ row: 3, spec: '256gb' }),
      variantRow({ row: 4, spec: '512gb', priceUsd: '300' }),
    ]);
    expect(diff?.variants).toContainEqual({
      spec: '512gb',
      color: undefined,
      kind: 'added',
      to: '300 / 6000',
    });
  });

  it('flags a removed variant with its old price', () => {
    const diff = diffFor({}, [variantRow({ spec: '128gb', color: 'Black' })]);
    expect(diff?.variants).toContainEqual({
      spec: '256gb',
      color: undefined,
      kind: 'removed',
      from: '80 / 1600',
    });
  });

  it('flags a variant price change', () => {
    const diff = diffFor({}, [
      variantRow({ spec: '128gb', color: 'Black', priceUsd: '60' }),
      variantRow({ row: 3, spec: '256gb' }),
    ]);
    expect(diff?.variants).toContainEqual({
      spec: '128gb',
      color: 'Black',
      kind: 'priceChanged',
      from: '50 / 1000',
      to: '60 / 1200',
    });
  });
});

describe('planProductUpdate skips unchanged values', () => {
  it('omits product fields that already match the current row', () => {
    const plan = planProductUpdate(
      productRow({
        categorySlug: 'phones',
        brand: 'Apple',
        outOfStock: 'TRUE',
        videoUrls: 'https://a.mp4',
      }),
      undefined,
      makeCurrent({
        categoryId: 'cat1',
        brandId: 'brand1',
        isOutOfStock: true,
        videoUrls: ['https://a.mp4'],
      }),
      makeRefs(),
    );
    expect(plan.errors).toEqual([]);
    expect(plan.data).toEqual({});
  });

  it('skips a base price whose USD and TMT already match', () => {
    const plan = planProductUpdate(
      productRow({ priceUsd: '100', priceTmt: '2000' }),
      undefined,
      makeCurrent(),
      makeRefs({ priceById: new Map([['bp1', { usd: '100', tmt: '2000' }]]) }),
    );
    expect(plan.errors).toEqual([]);
    expect(plan.basePrice).toBeUndefined();
    expect(plan.data?.cachedPrice).toBeUndefined();
  });

  it('updates a base price when the TMT differs (rate moved)', () => {
    const plan = planProductUpdate(
      productRow({ priceUsd: '100' }), // TMT derived = 2000 at rate 20
      undefined,
      makeCurrent(),
      makeRefs({ priceById: new Map([['bp1', { usd: '100', tmt: '1800' }]]) }),
    );
    expect(plan.basePrice).toEqual({
      priceId: 'bp1',
      name: 'iPhone 15',
      usd: '100',
      tmt: '2000',
    });
  });

  it('leaves a variant price untouched when it already matches', () => {
    const plan = planProductUpdate(
      productRow(),
      [variantRow({ spec: '128gb', priceUsd: '50', color: 'Black' })],
      makeCurrent(),
      makeRefs({ priceById: new Map([['vp1', { usd: '50', tmt: '1000' }]]) }),
    );
    expect(plan.tags).toEqual([
      { spec: '128gb', colorId: 'col1', priceId: 'vp1', price: undefined },
    ]);
  });
});
