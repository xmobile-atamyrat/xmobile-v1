import { fetchBrands } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { COLOR_FAMILY_LABEL_KEY } from '@/pages/lib/colorFamilies';
import { priceRangeLabel } from '@/pages/lib/priceFacet';
import { FilterState } from '@/pages/lib/hooks/useProductFilters';
import { BrandProps, ExtendedCategory } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { productIndexPageClasses } from '@/styles/classMaps/product';
import { fontClassName } from '@/styles/theme';
import { Box, Button, Typography } from '@mui/material';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface ActiveFilterChipsProps {
  filters: FilterState;
  onChange: (filters: Partial<FilterState>) => void;
}

/**
 * Active filter chips (spec 1457), web only: the mobile sheet has no chip row.
 * Every chip is a real selected filter; there is no fabricated state here.
 */
export default function ActiveFilterChips({
  filters,
  onChange,
}: ActiveFilterChipsProps) {
  const t = useTranslations();
  const router = useRouter();
  const { categories } = useCategoryContext();
  // Reference list, only for labelling the brand chips.
  const [brands, setBrands] = useState<BrandProps[]>([]);

  useEffect(() => {
    fetchBrands()
      .then(setBrands)
      .catch(() => setBrands([]));
  }, []);

  const categoryById = new Map<string, ExtendedCategory>();
  const collectCategories = (cats: ExtendedCategory[]) => {
    cats.forEach((cat) => {
      categoryById.set(cat.id, cat);
      if (cat.successorCategories?.length) {
        collectCategories(cat.successorCategories);
      }
    });
  };
  collectCategories(categories ?? []);

  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  filters.categoryIds.forEach((id) => {
    const cat = categoryById.get(id);
    if (!cat) return;
    chips.push({
      key: `category-${id}`,
      label: parseName(cat.name, router.locale ?? 'ru'),
      onRemove: () =>
        onChange({
          categoryIds: filters.categoryIds.filter((cid) => cid !== id),
        }),
    });
  });

  filters.brandIds.forEach((id) => {
    const brand = brands.find((b) => b.id === id);
    if (!brand) return;
    chips.push({
      key: `brand-${id}`,
      label: brand.name,
      onRemove: () =>
        onChange({
          brandIds: filters.brandIds.filter((bid) => bid !== id),
        }),
    });
  });

  filters.colors.forEach((family) => {
    chips.push({
      key: `color-${family}`,
      label: t(COLOR_FAMILY_LABEL_KEY[family]),
      onRemove: () =>
        onChange({ colors: filters.colors.filter((f) => f !== family) }),
    });
  });

  if (filters.minPrice || filters.maxPrice) {
    chips.push({
      key: 'price',
      label: `${priceRangeLabel(
        filters.minPrice ? Number(filters.minPrice) : null,
        filters.maxPrice ? Number(filters.maxPrice) : null,
      )} TMT`,
      onRemove: () => onChange({ minPrice: '', maxPrice: '' }),
    });
  }

  if (filters.inStock) {
    chips.push({
      key: 'in-stock',
      label: t('inStockOnly'),
      onRemove: () => onChange({ inStock: false }),
    });
  }

  return (
    <Box className={productIndexPageClasses.activeFilters.wrap}>
      {chips.length > 0 && (
        <Typography
          className={`${fontClassName.className} ${productIndexPageClasses.activeFilters.label}`}
        >
          {`${t('activeFilters')}:`}
        </Typography>
      )}
      {chips.map((chip) => (
        <Button
          key={chip.key}
          disableRipple
          disableElevation
          onClick={chip.onRemove}
          className={`${fontClassName.className} ${productIndexPageClasses.activeFilters.chip}`}
        >
          <span className={productIndexPageClasses.activeFilters.chipLabel}>
            {chip.label}
          </span>
          <X
            size={13}
            className={productIndexPageClasses.activeFilters.chipIcon}
          />
        </Button>
      ))}
    </Box>
  );
}
