import type { AdminProductListItem } from '@/pages/api/product/admin-list.page';
import {
  filterOverviewProducts,
  sortOverviewProducts,
} from '@/pages/product/overview/lib';
import { describe, expect, it } from 'vitest';

const product = (
  over: Partial<AdminProductListItem> = {},
): AdminProductListItem => ({
  id: 'p1',
  name: JSON.stringify({ en: 'iPhone 15', tk: 'iPhone 15' }),
  categoryId: 'phones',
  priceCount: 2,
  isOutOfStock: false,
  ...over,
});

const noFilters = {
  searchKeyword: '',
  categoryId: '',
  outOfStockOnly: false,
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
      isOutOfStock: true,
    });
    const wrongCategory = product({
      id: 'b',
      name: JSON.stringify({ en: 'Galaxy Book' }),
      categoryId: 'laptops',
      isOutOfStock: true,
    });
    const inStock = product({
      id: 'c',
      name: JSON.stringify({ en: 'Galaxy S23' }),
      categoryId: 'phones',
      isOutOfStock: false,
    });

    const result = filterOverviewProducts([wanted, wrongCategory, inStock], {
      searchKeyword: 'galaxy',
      categoryId: 'phones',
      outOfStockOnly: true,
      locale: 'en',
    });

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

  it('does not mutate the array it was given', () => {
    const products = [named('z', { en: 'Zebra' }), named('a', { en: 'Apple' })];

    sortOverviewProducts(products, 'en');

    expect(products.map(({ id }) => id)).toEqual(['z', 'a']);
  });
});
