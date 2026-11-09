import { ColorFamily, isColorFamily } from '@/pages/lib/colorFamilies';
import { SORT_OPTIONS } from '@/pages/lib/constants';
import { NextRouter, useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

export interface FilterState {
  categoryIds: string[];
  brandIds: string[];
  colors: ColorFamily[];
  minPrice: string;
  maxPrice: string;
  sortBy: string;
  inStock: boolean;
}

interface UseProductFiltersReturn {
  filters: FilterState;
  // False until `filters` reflects the URL, which a full load with a query
  // string only knows after hydration.
  ready: boolean;
  setFilters: (filters: Partial<FilterState>) => void;
  updateUrl: (newFilters: FilterState) => void;
}

/** Next.js query params can be string or string[] — normalize to a string array. */
export function normalizeQueryStringArray(
  value: string | string[] | undefined,
): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function filtersFromQuery(
  query: NextRouter['query'],
  initialSortBy: string,
): FilterState {
  const { categoryIds, brandIds, colors, minPrice, maxPrice, sortBy, inStock } =
    query;

  return {
    categoryIds: normalizeQueryStringArray(categoryIds),
    brandIds: normalizeQueryStringArray(brandIds),
    colors: normalizeQueryStringArray(colors).filter(isColorFamily),
    minPrice: (minPrice as string) || '',
    maxPrice: (maxPrice as string) || '',
    sortBy: (sortBy as string) || initialSortBy,
    inStock: inStock === '1',
  };
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

function sameFilters(a: FilterState, b: FilterState): boolean {
  return (
    sameList(a.categoryIds, b.categoryIds) &&
    sameList(a.brandIds, b.brandIds) &&
    sameList(a.colors, b.colors) &&
    a.minPrice === b.minPrice &&
    a.maxPrice === b.maxPrice &&
    a.sortBy === b.sortBy &&
    a.inStock === b.inStock
  );
}

export function useProductFilters(
  initialSortBy: string = SORT_OPTIONS.NEWEST,
): UseProductFiltersReturn {
  const router = useRouter();
  const [filters, setFiltersState] = useState<FilterState>(() =>
    filtersFromQuery(router.isReady ? router.query : {}, initialSortBy),
  );
  const [ready, setReady] = useState(router.isReady);

  const updateUrl = useCallback(
    (newFilters: FilterState) => {
      // Preserve untracked params (search, utm_*, etc.)
      const query: any = { ...router.query };

      // Clear filter params before re-adding
      const knownKeys = [
        'categoryId',
        'categoryIds',
        'brandIds',
        'colors',
        'colorIds',
        'minPrice',
        'maxPrice',
        'sortBy',
        'inStock',
        'page',
      ];
      knownKeys.forEach((key) => delete query[key]);

      // Landing Mode vs Filter Mode:
      // - categoryId (singular): user navigated from header, may be subcategory
      // - categoryIds (plural): user selected from filter sidebar (root categories only)
      // Keep them separate because subcategories don't appear in filter checkboxes
      const currentCategoryId = router.query.categoryId as string | undefined;
      const preserveLandingCategory =
        currentCategoryId && newFilters.categoryIds.length === 0;

      if (preserveLandingCategory) {
        query.categoryId = currentCategoryId;
      } else if (newFilters.categoryIds.length > 0) {
        query.categoryIds = newFilters.categoryIds;
      }

      if (newFilters.brandIds.length > 0) {
        query.brandIds = newFilters.brandIds;
      }

      if (newFilters.colors.length > 0) {
        query.colors = newFilters.colors;
      }

      if (newFilters.minPrice) query.minPrice = newFilters.minPrice;
      if (newFilters.maxPrice) query.maxPrice = newFilters.maxPrice;
      if (newFilters.inStock) query.inStock = '1';

      if (newFilters.sortBy && newFilters.sortBy !== initialSortBy) {
        query.sortBy = newFilters.sortBy;
      }

      router.push(
        {
          pathname: router.pathname, // Stay on the current page (home filters its own grid)
          query,
        },
        undefined,
        { shallow: true },
      );
    },
    [router, initialSortBy],
  );

  // Sync state from URL on page load/navigation. Mostly the URL just echoes
  // what setFilters already applied, and a new object would refetch the list.
  useEffect(() => {
    if (!router.isReady) return;

    const next = filtersFromQuery(router.query, initialSortBy);
    setFiltersState((prev) => (sameFilters(prev, next) ? prev : next));
    setReady(true);
  }, [router.isReady, router.query, initialSortBy]);

  const setFilters = (newFilters: Partial<FilterState>) => {
    setFiltersState((prev) => {
      const updated = { ...prev, ...newFilters };
      updateUrl(updated);
      return updated;
    });
  };

  return { filters, ready, setFilters, updateUrl };
}
