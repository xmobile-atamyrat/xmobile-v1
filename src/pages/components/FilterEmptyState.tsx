import {
  FILTER_DIMENSIONS,
  FilterDimension,
} from '@/pages/lib/filterRelaxations';
import { FilterOptions } from '@/pages/lib/hooks/useFilterOptions';
import { FilterState } from '@/pages/lib/hooks/useProductFilters';
import { productIndexPageClasses } from '@/styles/classMaps/product';
import { fontClassName } from '@/styles/theme';
import { Box, Button, Typography } from '@mui/material';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

const CLEARED: Record<FilterDimension, Partial<FilterState>> = {
  brands: { brandIds: [] },
  colors: { colors: [] },
  inStock: { inStock: false },
};

const LABEL_KEY: Record<FilterDimension, string> = {
  brands: 'brands',
  colors: 'color',
  inStock: 'inStockOnly',
};

interface FilterEmptyStateProps {
  options: FilterOptions | null;
  onChange: (filters: Partial<FilterState>) => void;
}

/**
 * Under "No products found": each filter whose removal would bring products
 * back, biggest win first, plus clearing them all. Every number is a real
 * count; when no single removal helps, only "Clear all" shows.
 */
export default function FilterEmptyState({
  options,
  onChange,
}: FilterEmptyStateProps) {
  const t = useTranslations();
  // Stale options from the previous filter set would suggest the wrong fix.
  if (options == null || options.total !== 0) return null;

  const active = FILTER_DIMENSIONS.filter(
    (dimension) => options.relaxations[dimension] != null,
  );
  if (active.length === 0) return null;

  const helpful = active
    .filter((dimension) => (options.relaxations[dimension] ?? 0) > 0)
    .sort(
      (a, b) => (options.relaxations[b] ?? 0) - (options.relaxations[a] ?? 0),
    );
  const clearAll = active.reduce<Partial<FilterState>>(
    (acc, dimension) => ({ ...acc, ...CLEARED[dimension] }),
    {},
  );

  return (
    <Box className="mt-5 flex flex-col items-center gap-3">
      {helpful.length > 0 && (
        <>
          <Typography
            className={`${fontClassName.className} ${productIndexPageClasses.emptyState.subtitle}`}
          >
            {t('tryRemovingFilter')}
          </Typography>
          <Box className="flex flex-wrap justify-center gap-2.5">
            {helpful.map((dimension) => (
              <Button
                key={dimension}
                disableRipple
                disableElevation
                onClick={() => onChange(CLEARED[dimension])}
                className={`${fontClassName.className} ${productIndexPageClasses.activeFilters.chip}`}
              >
                <span>
                  {t('withoutFilter', {
                    filter: t(LABEL_KEY[dimension]),
                    count: options.relaxations[dimension] ?? 0,
                  })}
                </span>
                <X
                  size={13}
                  className={productIndexPageClasses.activeFilters.chipIcon}
                />
              </Button>
            ))}
          </Box>
        </>
      )}
      {active.length > 1 || helpful.length === 0 ? (
        <Button
          disableRipple
          disableElevation
          onClick={() => onChange(clearAll)}
          className={`${fontClassName.className} ${productIndexPageClasses.activeFilters.chip}`}
        >
          {t('clearAll')}
        </Button>
      ) : null}
    </Box>
  );
}
