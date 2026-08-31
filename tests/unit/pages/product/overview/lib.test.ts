import type { AdminProductListItem } from '@/pages/api/product/admin-list.page';
import {
  filterOverviewProducts,
  NO_BRAND_FILTER,
  sortOverviewProducts,
} from '@/pages/product/overview/lib';
import { describe, expect, it } from 'vitest';

const product = (
  over: Partial<AdminProductListItem> = {},
): AdminProductListItem => ({
  id: 'p1',
  name: JSON.stringify({ en: 'iPhone 15', tk: 'iPhone 15' }),
  categoryId: 'phones',
  brandId: 'apple',
  isOutOfStock: false,
  updatedAt: '2026-01-01T00:00:00.000Z',
  basePriceTmt: '4200',
  basePriceIssue: null,
  ...over,
});

const noFilters = {
  searchKeyword: '',
  categoryId: '',
  outOfStockOnly: false,
  brandId: '',
  missingPriceOnly: false,
  locale: 'en',
};

describe('filterOverviewProducts', () => {
  it('returns every product when no filter is active', () => {
    const products = [product({ id: 'a' }), product({ id: 'b' })];

    expect(filterOverviewProducts(products, noFilters)).toEqual(products);
  });

  it('keeps only out-of-stock products when the toggle is on', () => {
    const inStock = product({ id: 'a', isOutOfStock: false });
    const sold = product({ id: 'b', isOutOfStock: true });

    const result = filterOverviewProducts([inStock, sold], {
      ...noFilters,
      outOfStockOnly: true,
    });

    expect(result).toEqual([sold]);
  });

  it('keeps only products of the selected category', () => {
    const phone = product({ id: 'a', categoryId: 'phones' });
    const laptop = product({ id: 'b', categoryId: 'laptops' });

    const result = filterOverviewProducts([phone, laptop], {
      ...noFilters,
      categoryId: 'laptops',
    });

    expect(result).toEqual([laptop]);
  });

  it('keeps only products of the selected brand', () => {
    const apple = product({ id: 'a', brandId: 'apple' });
    const samsung = product({ id: 'b', brandId: 'samsung' });

    const result = filterOverviewProducts([apple, samsung], {
      ...noFilters,
      brandId: 'samsung',
    });

    expect(result).toEqual([samsung]);
  });

  it('keeps only brandless products under the no-brand sentinel', () => {
    // An empty brandId already means "any brand", so the absence of a brand
    // needs a value the filter can tell apart from "no filter at all".
    const branded = product({ id: 'a', brandId: 'apple' });
    const unbranded = product({ id: 'b', brandId: null });

    const result = filterOverviewProducts([branded, unbranded], {
      ...noFilters,
      brandId: NO_BRAND_FILTER,
    });

    expect(result).toEqual([unbranded]);
  });

  it('treats an unset price and a dead reference as the same problem', () => {
    const priced = product({ id: 'a', basePriceIssue: null });
    const unpriced = product({
      id: 'b',
      basePriceTmt: null,
      basePriceIssue: 'noPrice',
    });
    const dangling = product({
      id: 'c',
      basePriceTmt: null,
      basePriceIssue: 'danglingRef',
    });

    const result = filterOverviewProducts([priced, unpriced, dangling], {
      ...noFilters,
      missingPriceOnly: true,
    });

    expect(result.map(({ id }) => id)).toEqual(['b', 'c']);
  });

  it('matches the localized name case-insensitively', () => {
    const iphone = product({
      id: 'a',
      name: JSON.stringify({ en: 'iPhone 15' }),
    });
    const galaxy = product({
      id: 'b',
      name: JSON.stringify({ en: 'Galaxy S24' }),
    });

    const result = filterOverviewProducts([iphone, galaxy], {
      ...noFilters,
      searchKeyword: 'GALAXY',
    });

    expect(result).toEqual([galaxy]);
  });

  it('ignores a whitespace-only search keyword', () => {
    const products = [product({ id: 'a' }), product({ id: 'b' })];

    expect(
      filterOverviewProducts(products, { ...noFilters, searchKeyword: '   ' }),
    ).toEqual(products);
  });

  it('requires every active filter to match', () => {
    const wanted = product({
      id: 'a',
      name: JSON.stringify({ en: 'Galaxy S24' }),
      categoryId: 'phones',
      brandId: 'samsung',
      isOutOfStock: true,
    });
    const wrongCategory = product({
      id: 'b',
      name: JSON.stringify({ en: 'Galaxy Book' }),
      categoryId: 'laptops',
      brandId: 'samsung',
      isOutOfStock: true,
    });
    const wrongBrand = product({
      id: 'c',
      name: JSON.stringify({ en: 'Galaxy S23' }),
      categoryId: 'phones',
      brandId: 'apple',
      isOutOfStock: true,
    });
    const inStock = product({
      id: 'd',
      name: JSON.stringify({ en: 'Galaxy S22' }),
      categoryId: 'phones',
      brandId: 'samsung',
      isOutOfStock: false,
    });

    const result = filterOverviewProducts(
      [wanted, wrongCategory, wrongBrand, inStock],
      {
        searchKeyword: 'galaxy',
        categoryId: 'phones',
        brandId: 'samsung',
        outOfStockOnly: true,
        missingPriceOnly: false,
        locale: 'en',
      },
    );

    expect(result).toEqual([wanted]);
  });
});

describe('sortOverviewProducts', () => {
  const named = (id: string, name: Record<string, string>) =>
    product({ id, name: JSON.stringify(name) });

  it('orders by the name actually rendered, not the raw JSON blob', () => {
    // Sorting the stored blob would order these by whichever locale key comes
    // first in each string, which has nothing to do with the visible name.
    const zebra = named('z', { ch: 'AAA', en: 'Zebra phone' });
    const apple = named('a', { ch: 'ZZZ', en: 'Apple phone' });

    const result = sortOverviewProducts([zebra, apple], 'en');

    expect(result.map(({ id }) => id)).toEqual(['a', 'z']);
  });

  it('follows the active locale', () => {
    const first = named('1', { en: 'Alpha', tk: 'Yzy' });
    const second = named('2', { en: 'Beta', tk: 'Ada' });

    expect(
      sortOverviewProducts([first, second], 'tk').map(({ id }) => id),
    ).toEqual(['2', '1']);
  });

  it('reverses the name order for nameDesc', () => {
    const zebra = named('z', { en: 'Zebra' });
    const apple = named('a', { en: 'Apple' });

    expect(
      sortOverviewProducts([apple, zebra], 'en', 'nameDesc').map(
        ({ id }) => id,
      ),
    ).toEqual(['z', 'a']);
  });

  it('puts the newest edit first for editedRecent', () => {
    const old = product({ id: 'old', updatedAt: '2026-01-01T00:00:00.000Z' });
    const fresh = product({ id: 'new', updatedAt: '2026-08-01T00:00:00.000Z' });

    expect(
      sortOverviewProducts([old, fresh], 'en', 'editedRecent').map(
        ({ id }) => id,
      ),
    ).toEqual(['new', 'old']);
  });

  it('puts the stalest row first for editedStale', () => {
    const old = product({ id: 'old', updatedAt: '2026-01-01T00:00:00.000Z' });
    const fresh = product({ id: 'new', updatedAt: '2026-08-01T00:00:00.000Z' });

    expect(
      sortOverviewProducts([fresh, old], 'en', 'editedStale').map(
        ({ id }) => id,
      ),
    ).toEqual(['old', 'new']);
  });

  it('orders by price numerically, not as strings', () => {
    // '900' sorts after '4200' lexicographically, which is exactly the bug a
    // string comparison would introduce here.
    const cheap = product({ id: 'cheap', basePriceTmt: '900' });
    const dear = product({ id: 'dear', basePriceTmt: '4200' });

    expect(
      sortOverviewProducts([dear, cheap], 'en', 'priceAsc').map(({ id }) => id),
    ).toEqual(['cheap', 'dear']);
  });

  it('keeps unpriced products last in both price directions', () => {
    const unpriced = product({
      id: 'none',
      basePriceTmt: null,
      basePriceIssue: 'noPrice',
    });
    const cheap = product({ id: 'cheap', basePriceTmt: '900' });
    const dear = product({ id: 'dear', basePriceTmt: '4200' });

    expect(
      sortOverviewProducts([unpriced, dear, cheap], 'en', 'priceAsc').map(
        ({ id }) => id,
      ),
    ).toEqual(['cheap', 'dear', 'none']);
    expect(
      sortOverviewProducts([unpriced, cheap, dear], 'en', 'priceDesc').map(
        ({ id }) => id,
      ),
    ).toEqual(['dear', 'cheap', 'none']);
  });

  it('does not mutate the array it was given', () => {
    const products = [named('z', { en: 'Zebra' }), named('a', { en: 'Apple' })];

    sortOverviewProducts(products, 'en');

    expect(products.map(({ id }) => id)).toEqual(['z', 'a']);
  });
});
