import { colorFamilyOf, groupColorsByFamily } from '@/pages/lib/colorFamilies';
import { SORT_OPTIONS } from '@/pages/lib/constants';
import { FilterOptions } from '@/pages/lib/hooks/useFilterOptions';
import { FilterState } from '@/pages/lib/hooks/useProductFilters';
import { ExtendedCategory, ExtendedProduct } from '@/pages/lib/types';

export interface FavoriteProduct extends ExtendedProduct {
  colors: { id: string; name: string; hex: string }[];
}

type Compare = (a: FavoriteProduct, b: FavoriteProduct) => number;

function withSubcategories(
  selectedIds: string[],
  categories: ExtendedCategory[],
): Set<string> {
  const ids = new Set(selectedIds);
  const walk = (level: ExtendedCategory[], insideSelected: boolean) => {
    level.forEach((category) => {
      const selected = insideSelected || ids.has(category.id);
      if (selected) ids.add(category.id);
      walk(category.successorCategories ?? [], selected);
    });
  };
  walk(categories, false);
  return ids;
}

const priceBound = (value: string) => {
  const bound = parseFloat(value);
  return Number.isNaN(bound) ? null : bound;
};

const byPrice =
  (direction: 1 | -1): Compare =>
  (a, b) => {
    if (a.cachedPrice == null || b.cachedPrice == null) {
      return Number(a.cachedPrice == null) - Number(b.cachedPrice == null);
    }
    return (a.cachedPrice - b.cachedPrice) * direction;
  };

function compareFor(sortBy: string, locale: string): Compare | null {
  switch (sortBy) {
    case SORT_OPTIONS.PRICE_ASC:
      return byPrice(1);
    case SORT_OPTIONS.PRICE_DESC:
      return byPrice(-1);
    case SORT_OPTIONS.A_Z:
      return (a, b) => a.name.localeCompare(b.name, locale);
    default:
      return null;
  }
}

/**
 * The catalog's filters and sort, applied in the browser: the API sends the
 * whole favorites list, so changing them costs no request. Newest needs no
 * sorting because that is the order the list arrives in.
 */
export function filterAndSortFavorites(
  products: FavoriteProduct[],
  filters: FilterState,
  categories: ExtendedCategory[],
  locale: string,
): FavoriteProduct[] {
  const categoryIds = withSubcategories(filters.categoryIds, categories);
  const min = priceBound(filters.minPrice);
  const max = priceBound(filters.maxPrice);

  const matching = products.filter(
    ({ brandId, categoryId, cachedPrice, colors, outOfStockAt }) =>
      (categoryIds.size === 0 || categoryIds.has(categoryId)) &&
      (filters.brandIds.length === 0 ||
        (brandId != null && filters.brandIds.includes(brandId))) &&
      (filters.colors.length === 0 ||
        colors.some((color) =>
          filters.colors.includes(colorFamilyOf(color)),
        )) &&
      (!filters.inStock || outOfStockAt == null) &&
      (min == null || (cachedPrice != null && cachedPrice >= min)) &&
      (max == null || (cachedPrice != null && cachedPrice <= max)),
  );

  const compare = compareFor(filters.sortBy, locale);
  if (compare == null) return matching;
  return matching.sort(
    (a, b) =>
      Number(a.outOfStockAt != null) - Number(b.outOfStockAt != null) ||
      compare(a, b),
  );
}

/**
 * The rail options that still match the rest of the filters, the favorites
 * twin of /api/product/filters: each dimension ignores its own selection.
 */
export function favoriteFilterOptions(
  products: FavoriteProduct[],
  filters: FilterState,
  categories: ExtendedCategory[],
  locale: string,
): FilterOptions {
  const brandScope = filterAndSortFavorites(
    products,
    { ...filters, brandIds: [] },
    categories,
    locale,
  );
  const colorScope = filterAndSortFavorites(
    products,
    { ...filters, colors: [] },
    categories,
    locale,
  );
  const brandCounts: Record<string, number> = {};
  brandScope.forEach(({ brandId }) => {
    if (brandId != null) brandCounts[brandId] = (brandCounts[brandId] ?? 0) + 1;
  });
  const colorCounts: FilterOptions['colorCounts'] = {};
  colorScope.forEach(({ colors }) => {
    groupColorsByFamily(colors).forEach(({ family }) => {
      colorCounts[family] = (colorCounts[family] ?? 0) + 1;
    });
  });
  return { brandCounts, colorCounts };
}
