import { HomeBrand } from '@/lib/homeBrands';
import { useMarqueeScroll } from '@/pages/lib/hooks/useMarqueeScroll';
import { homePageClasses } from '@/styles/classMaps';
import { fontClassName } from '@/styles/theme';
import { Box, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

interface HomeBrandChipsProps {
  brands: HomeBrand[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/**
 * Mobile home's brand strip. It drifts like the banners until a brand is
 * picked, and swiping takes over at any time; tapping the picked brand clears
 * the pick.
 */
export default function HomeBrandChips({
  brands,
  selectedId,
  onSelect,
}: HomeBrandChipsProps) {
  const t = useTranslations();
  const rowRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const loopWidth = useMarqueeScroll(rowRef, copyRef, !selectedId);

  // A brand preselected from the URL may sit off-screen; bring it into view.
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !chip) return;
    const rowBox = row.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    row.scrollLeft +=
      chipBox.left - rowBox.left - (rowBox.width - chipBox.width) / 2;
    // Only on mount: later picks are taps on a chip that is already in view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (brands.length === 0) return null;

  // The second copy exists only to make the loop seamless, so it is hidden
  // from screen readers and the tab order; taps on it still pick the brand.
  const renderCopy = (copy: 0 | 1) => (
    <Box
      ref={copy === 0 ? copyRef : undefined}
      aria-hidden={copy === 1 || undefined}
      className={homePageClasses.brandCopy}
    >
      {brands.map((brand) => {
        const selected = brand.id === selectedId;
        return (
          <button
            key={brand.id}
            type="button"
            aria-pressed={selected}
            tabIndex={copy === 1 ? -1 : undefined}
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
  );

  return (
    <Box component="section" className={homePageClasses.mobileSection}>
      <Typography
        className={`${fontClassName.className} ${homePageClasses.newProductsTitle.mobile} mb-3`}
      >
        {t('chooseBrand')}
      </Typography>
      <Box ref={rowRef} className={homePageClasses.brandRow}>
        {renderCopy(0)}
        {loopWidth > 0 && renderCopy(1)}
      </Box>
    </Box>
  );
}
