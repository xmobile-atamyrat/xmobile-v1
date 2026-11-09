import { fetchProductFilterOptions } from '@/pages/lib/apis';
import { ColorFamily } from '@/pages/lib/colorFamilies';
import { FilterState } from '@/pages/lib/hooks/useProductFilters';
import { useEffect, useState } from 'react';

export interface FilterOptions {
  colorFamilies: ColorFamily[];
  brandIds: string[];
}

/** What the listing is about before any rail filter: its category or search. */
export interface FilterScope {
  categoryIds: string[];
  searchKeyword?: string;
}

/**
 * The rail options that still match the rest of `filters` inside `scope`.
 * Null until the first answer (or after a failure with nothing to show);
 * a refetch keeps the previous options up so the rail doesn't flicker.
 */
export function useFilterOptions(
  scope: FilterScope,
  filters: FilterState,
  enabled = true,
): FilterOptions | null {
  const [options, setOptions] = useState<FilterOptions | null>(null);

  const params = {
    categoryIds:
      filters.categoryIds.length > 0 ? filters.categoryIds : scope.categoryIds,
    brandIds: filters.brandIds,
    colors: filters.colors,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    searchKeyword: scope.searchKeyword,
    inStock: filters.inStock,
  };
  const key = JSON.stringify(params);

  useEffect(() => {
    if (!enabled) return () => undefined;
    let cancelled = false;
    fetchProductFilterOptions(JSON.parse(key))
      .then(({ colorFamilies, brandIds }) => {
        if (!cancelled) setOptions({ colorFamilies, brandIds });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [key, enabled]);

  return options;
}
