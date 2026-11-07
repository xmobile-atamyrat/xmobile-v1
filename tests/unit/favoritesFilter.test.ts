import { SORT_OPTIONS } from '@/pages/lib/constants';
import {
  FavoriteProduct,
  filterAndSortFavorites,
} from '@/pages/lib/favoritesFilter';
import { FilterState } from '@/pages/lib/hooks/useProductFilters';
import { ExtendedCategory } from '@/pages/lib/types';
import { describe, expect, it } from 'vitest';

const product = (overrides: Partial<FavoriteProduct>) =>
  ({
    id: 'p',
    name: 'Product',
    categoryId: 'c',
    brandId: null,
    cachedPrice: 100,
    outOfStockAt: null,
    colors: [],
    ...overrides,
  }) as FavoriteProduct;

const noFilters: FilterState = {
  categoryIds: [],
  brandIds: [],
  colorIds: [],
  minPrice: '',
  maxPrice: '',
  sortBy: SORT_OPTIONS.NEWEST,
  inStock: false,
};

const phones = {
  id: 'phones',
  successorCategories: [
    {
      id: 'android',
      successorCategories: [{ id: 'foldable', successorCategories: [] }],
    },
  ],
} as unknown as ExtendedCategory;

const apply = (
  products: FavoriteProduct[],
  filters: Partial<FilterState>,
  categories: ExtendedCategory[] = [],
) =>
  filterAndSortFavorites(
    products,
    { ...noFilters, ...filters },
    categories,
    'en',
  ).map(({ id }) => id);

describe('filterAndSortFavorites', () => {
  it('keeps the order the server sent when nothing is chosen', () => {
    const products = [product({ id: 'b' }), product({ id: 'a' })];

    expect(apply(products, {})).toEqual(['b', 'a']);
  });

  describe('filters', () => {
    it('keeps only the chosen brands', () => {
      const products = [
        product({ id: 'apple', brandId: 'b1' }),
        product({ id: 'samsung', brandId: 'b2' }),
        product({ id: 'unbranded', brandId: null }),
      ];

      expect(apply(products, { brandIds: ['b1'] })).toEqual(['apple']);
    });

    it('keeps a product carrying any of the chosen colors', () => {
      const products = [
        product({ id: 'both', colors: [{ id: 'black' }, { id: 'red' }] }),
        product({ id: 'blue', colors: [{ id: 'blue' }] }),
        product({ id: 'none', colors: [] }),
      ];

      expect(apply(products, { colorIds: ['red', 'green'] })).toEqual(['both']);
    });

    it('reaches subcategories of a chosen category at any depth', () => {
      const products = [
        product({ id: 'root', categoryId: 'phones' }),
        product({ id: 'child', categoryId: 'android' }),
        product({ id: 'grandchild', categoryId: 'foldable' }),
        product({ id: 'other', categoryId: 'laptops' }),
      ];

      expect(apply(products, { categoryIds: ['phones'] }, [phones])).toEqual([
        'root',
        'child',
        'grandchild',
      ]);
    });

    it('still matches a chosen category missing from the loaded tree', () => {
      const products = [product({ id: 'kept', categoryId: 'unloaded' })];

      expect(apply(products, { categoryIds: ['unloaded'] })).toEqual(['kept']);
    });

    it('hides sold-out products when asked for in stock only', () => {
      const products = [
        product({ id: 'available' }),
        product({ id: 'gone', outOfStockAt: new Date('2026-01-01') }),
      ];

      expect(apply(products, { inStock: true })).toEqual(['available']);
    });

    it('includes both ends of the price range', () => {
      const products = [
        product({ id: 'under', cachedPrice: 99 }),
        product({ id: 'low', cachedPrice: 100 }),
        product({ id: 'high', cachedPrice: 200 }),
        product({ id: 'over', cachedPrice: 201 }),
      ];

      expect(apply(products, { minPrice: '100', maxPrice: '200' })).toEqual([
        'low',
        'high',
      ]);
    });

    it('leaves out an unpriced product once a price bound is set', () => {
      const products = [product({ id: 'unpriced', cachedPrice: null })];

      expect(apply(products, { maxPrice: '500' })).toEqual([]);
    });

    it('ignores a price bound that is not a number', () => {
      const products = [product({ id: 'kept', cachedPrice: 100 })];

      expect(apply(products, { minPrice: 'abc' })).toEqual(['kept']);
    });

    it('requires every kind of filter to match', () => {
      const products = [
        product({ id: 'match', brandId: 'b1', cachedPrice: 100 }),
        product({ id: 'wrong-brand', brandId: 'b2', cachedPrice: 100 }),
        product({ id: 'too-dear', brandId: 'b1', cachedPrice: 900 }),
      ];

      expect(apply(products, { brandIds: ['b1'], maxPrice: '500' })).toEqual([
        'match',
      ]);
    });
  });

  describe('sorting', () => {
    const priced = [
      product({ id: 'mid', cachedPrice: 200 }),
      product({ id: 'cheap', cachedPrice: 100 }),
      product({ id: 'dear', cachedPrice: 300 }),
    ];

    it('puts the cheapest first', () => {
      expect(apply(priced, { sortBy: SORT_OPTIONS.PRICE_ASC })).toEqual([
        'cheap',
        'mid',
        'dear',
      ]);
    });

    it('puts the most expensive first', () => {
      expect(apply(priced, { sortBy: SORT_OPTIONS.PRICE_DESC })).toEqual([
        'dear',
        'mid',
        'cheap',
      ]);
    });

    it.each([SORT_OPTIONS.PRICE_ASC, SORT_OPTIONS.PRICE_DESC])(
      'keeps unpriced products last for %s',
      (sortBy) => {
        const products = [
          product({ id: 'unpriced', cachedPrice: null }),
          product({ id: 'priced', cachedPrice: 100 }),
        ];

        expect(apply(products, { sortBy })).toEqual(['priced', 'unpriced']);
      },
    );

    it('sorts names alphabetically, ignoring case', () => {
      const products = [
        product({ id: 'c', name: 'Charger' }),
        product({ id: 'a', name: 'adapter' }),
        product({ id: 'b', name: 'Battery' }),
      ];

      expect(apply(products, { sortBy: SORT_OPTIONS.A_Z })).toEqual([
        'a',
        'b',
        'c',
      ]);
    });

    it('keeps sold-out products below available ones in every order', () => {
      const products = [
        product({
          id: 'gone',
          cachedPrice: 100,
          outOfStockAt: new Date('2026-01-01'),
        }),
        product({ id: 'available', cachedPrice: 300 }),
      ];

      expect(apply(products, { sortBy: SORT_OPTIONS.PRICE_ASC })).toEqual([
        'available',
        'gone',
      ]);
    });

    it('does not reorder the list it was given', () => {
      const products = [...priced];

      apply(products, { sortBy: SORT_OPTIONS.PRICE_ASC });

      expect(products.map(({ id }) => id)).toEqual(['mid', 'cheap', 'dear']);
    });
  });
});
