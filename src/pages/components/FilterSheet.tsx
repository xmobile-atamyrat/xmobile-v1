import FilterSidebar from '@/pages/components/FilterSidebar';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { FilterState } from '@/pages/lib/hooks/useProductFilters';
import { filterSidebarClasses } from '@/styles/classMaps/components/filterSidebar';
import { fontClassName } from '@/styles/theme';
import { Box, Button, Dialog, Slide, Typography } from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import { useTranslations } from 'next-intl';
import React, { useEffect, useState } from 'react';

const SlideTransition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const noFilters: FilterState = {
  categoryIds: [],
  brandIds: [],
  colorIds: [],
  minPrice: '',
  maxPrice: '',
  sortBy: '',
  inStock: false,
};

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  hideSections?: ('categories' | 'brands')[];
}

/** Mobile bottom sheet around FilterSidebar. Choices only apply on 'Apply'. */
export default function FilterSheet({
  open,
  onClose,
  filters,
  onApply,
  hideSections,
}: FilterSheetProps) {
  const t = useTranslations();
  const { categories } = useCategoryContext();
  const [localFilters, setLocalFilters] = useState(noFilters);

  useEffect(() => {
    if (open) setLocalFilters(filters);
  }, [open, filters]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      TransitionComponent={SlideTransition}
      fullWidth
      PaperProps={{
        sx: {
          position: 'fixed',
          bottom: 0,
          m: 0,
          width: '100%',
          maxHeight: '88vh',
          '@supports (height: 1dvh)': { maxHeight: '88dvh' },
          overflow: 'hidden',
          borderRadius: '26px 26px 0 0',
        },
      }}
    >
      <Box className="flex min-h-0 flex-1 flex-col bg-white">
        <Box className={filterSidebarClasses.dragHandle} />
        <Box className={filterSidebarClasses.header}>
          <Typography
            className={`${fontClassName.className} ${filterSidebarClasses.title}`}
          >
            {t('filter') || 'Filter'}
          </Typography>
          <Typography
            className={`${fontClassName.className} ${filterSidebarClasses.resetButton}`}
            onClick={() => setLocalFilters(noFilters)}
          >
            {t('clear') || 'Clear'}
          </Typography>
        </Box>
        <Box className={filterSidebarClasses.body}>
          <FilterSidebar
            variant="mobile"
            categories={categories}
            selectedCategoryIds={localFilters.categoryIds}
            selectedBrandIds={localFilters.brandIds}
            selectedColorIds={localFilters.colorIds}
            minPrice={localFilters.minPrice}
            maxPrice={localFilters.maxPrice}
            sortBy={localFilters.sortBy}
            inStock={localFilters.inStock}
            onFilterChange={(newFilters) => {
              setLocalFilters((prev) => ({ ...prev, ...newFilters }));
            }}
            hideSections={hideSections}
          />
        </Box>
        <Box className={filterSidebarClasses.footer}>
          <Button
            disableElevation
            className={`${fontClassName.className} ${filterSidebarClasses.clearButton}`}
            onClick={() => setLocalFilters(noFilters)}
          >
            {t('clear') || 'Clear'}
          </Button>
          <Button
            disableElevation
            className={`${fontClassName.className} ${filterSidebarClasses.applyButton}`}
            onClick={() => {
              onApply(localFilters);
              onClose();
            }}
          >
            {t('apply') || 'Apply'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
