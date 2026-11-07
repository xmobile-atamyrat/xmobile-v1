import { fetchBrands, fetchColors } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { mergeSameColors } from '@/pages/lib/colorGroups';
import { FILTER_MAX_PRICE } from '@/pages/lib/constants';
import { FilterState } from '@/pages/lib/hooks/useProductFilters';
import { BrandProps, ExtendedCategory } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { productIndexPageClasses } from '@/styles/classMaps/product';
import { fontClassName } from '@/styles/theme';
import { Box, Button, Typography } from '@mui/material';
import { Color } from '@prisma/client';
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
  // Reference lists, only for labelling the chips.
  const [brands, setBrands] = useState<BrandProps[]>([]);
  const [colors, setColors] = useState<Color[]>([]);

  useEffect(() => {
    fetchBrands()
      .then(setBrands)
      .catch(() => setBrands([]));
    fetchColors()
      .then(setColors)
      .catch(() => setColors([]));
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

  // One swatch in the sidebar can stand for the same color in several brands,
  // so its ids share one chip and removing the chip clears all of them.
  const selectedColors = filters.colorIds
    .map((id) => colors.find((c) => c.id === id))
    .filter((c): c is Color => c != null);
  mergeSameColors(selectedColors).forEach((swatch) => {
    chips.push({
      key: `color-${swatch.key}`,
      label: swatch.name,
      onRemove: () =>
        onChange({
          colorIds: filters.colorIds.filter((cid) => !swatch.ids.includes(cid)),
        }),
    });
  });

  if (filters.minPrice || filters.maxPrice) {
    chips.push({
      key: 'price',
      label: `${filters.minPrice || 0} – ${
        filters.maxPrice || FILTER_MAX_PRICE
      } TMT`,
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
