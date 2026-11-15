import { HomeBrand } from '@/lib/homeBrands';
import { homePageClasses } from '@/styles/classMaps';
import { fontClassName } from '@/styles/theme';
import { Box, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';

interface HomeBrandChipsProps {
  brands: HomeBrand[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/** Mobile home's brand strip; tapping the picked brand clears the pick. */
export default function HomeBrandChips({
  brands,
  selectedId,
  onSelect,
}: HomeBrandChipsProps) {
  const t = useTranslations();
  if (brands.length === 0) return null;

  return (
    <Box component="section" className={homePageClasses.mobileSection}>
      <Typography
        className={`${fontClassName.className} ${homePageClasses.newProductsTitle.mobile} mb-3`}
      >
        {t('chooseBrand')}
      </Typography>
      <Box className={homePageClasses.brandRow}>
        {brands.map((brand) => {
          const selected = brand.id === selectedId;
          return (
            <button
              key={brand.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(selected ? null : brand.id)}
              className={`${fontClassName.className} ${homePageClasses.brandChip} ${
                selected
                  ? homePageClasses.brandChipSelected
                  : homePageClasses.brandChipIdle
              }`}
            >
              {brand.name}
            </button>
          );
        })}
      </Box>
    </Box>
  );
}
