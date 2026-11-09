import { fetchProductFilterOptions } from '@/pages/lib/apis';
import { ColorFamily } from '@/pages/lib/colorFamilies';
import { FilterRelaxations } from '@/pages/lib/filterRelaxations';
import { PriceFacet } from '@/pages/lib/priceFacet';
import { FilterState } from '@/pages/lib/hooks/useProductFilters';
import { useEffect, useState } from 'react';

/** Products each option would show; an option missing here matches none. */
export interface FilterOptions {
  total: number;
  relaxations: FilterRelaxations;
  brandCounts: Record<string, number>;
  colorCounts: Partial<Record<ColorFamily, number>>;
  price: PriceFacet | null;
}

/** What the listing is about before any rail filter: its category or search. */
export interface FilterScope {
  categoryIds: string[];
  searchKeyword?: string;
}

/**
 * The rail options that still match the rest of `filters` inside `scope`.
 * `options` is null until the first answer (or after a failure with nothing
 * to show); a refetch keeps the previous ones up so the rail doesn't flicker.
 * `isCurrent` says whether they answer these exact filters, for numbers that
 * must not lag behind, like the sheet's "Show 37 products".
 */
export function useFilterOptions(
  scope: FilterScope,
  filters: FilterState,
  enabled = true,
): { options: FilterOptions | null; isCurrent: boolean } {
  const [answer, setAnswer] = useState<{
    key: string;
    options: FilterOptions;
  } | null>(null);

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
      .then(({ total, relaxations, brandCounts, colorCounts, price }) => {
        if (!cancelled) {
          setAnswer({
            key,
            options: { total, relaxations, brandCounts, colorCounts, price },
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [key, enabled]);

  return {
    options: answer?.options ?? null,
    isCurrent: answer?.key === key,
  };
}
