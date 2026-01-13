import { SORT_OPTIONS } from '@/pages/lib/constants';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

export interface FilterState {
  categoryIds: string[];
  brandIds: string[];
  minPrice: string;
  maxPrice: string;
  sortBy: string;
}

interface UseProductFiltersReturn {
  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;
  updateUrl: (newFilters: FilterState) => void;
}

// Next.js query params can be string or string[] - normalize to array
function normalizeArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function useProductFilters(
  initialSortBy: string = SORT_OPTIONS.NEWEST,
): UseProductFiltersReturn {
  const router = useRouter();
  const [filters, setFiltersState] = useState<FilterState>({
    categoryIds: [],
    brandIds: [],
    minPrice: '',
    maxPrice: '',
    sortBy: initialSortBy,
  });

  const updateUrl = useCallback(
    (newFilters: FilterState) => {
      // Preserve untracked params (search, utm_*, etc.)
      const query: any = { ...router.query };

      // Clear filter params before re-adding
      const knownKeys = [
        'categoryId',
        'categoryIds',
        'brandIds',
        'minPrice',
        'maxPrice',
        'sortBy',
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

      if (newFilters.minPrice) query.minPrice = newFilters.minPrice;
      if (newFilters.maxPrice) query.maxPrice = newFilters.maxPrice;

      if (newFilters.sortBy && newFilters.sortBy !== initialSortBy) {
        query.sortBy = newFilters.sortBy;
      }

      router.push(
        {
          pathname: router.pathname === '/' ? '/product' : router.pathname, // Redirect home to /product when filters applied
          query,
        },
        undefined,
        { shallow: true },
      );
    },
    [router, initialSortBy],
  );

  // Sync state from URL on page load/navigation
  useEffect(() => {
    if (!router.isReady) return;

    const { categoryIds, brandIds, minPrice, maxPrice, sortBy } = router.query;

    setFiltersState({
      categoryIds: normalizeArray(categoryIds),
      brandIds: normalizeArray(brandIds),
      minPrice: (minPrice as string) || '',
      maxPrice: (maxPrice as string) || '',
      sortBy: (sortBy as string) || initialSortBy,
    });
  }, [router.isReady, router.query, initialSortBy]);

  const setFilters = (newFilters: Partial<FilterState>) => {
    setFiltersState((prev) => {
      const updated = { ...prev, ...newFilters };
      updateUrl(updated);
      return updated;
    });
  };

  return { filters, setFilters, updateUrl };
}
