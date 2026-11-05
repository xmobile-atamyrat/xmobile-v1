import { usePlatform } from '@/pages/lib/PlatformContext';
import ProcurementSheet from '@/pages/procurement/components/ProcurementSheet';
import { MarkDot } from '@/pages/procurement/components/prices/PriceCell';
import {
  markOf,
  PRICE_MARKS,
} from '@/pages/procurement/components/prices/marks';
import { HISTORY_COLORS } from '@/pages/procurement/lib/types';
import { pricesClasses as pc } from '@/styles/classMaps/procurement/prices';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, Menu, Typography } from '@mui/material';
import { OrderPriceColor } from '@prisma/client';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface MarkPickerTarget {
  productId: string;
  supplierId: string;
  productName: string;
  supplierName: string;
  color: OrderPriceColor | null | undefined;
  /** The mark button, for the desktop menu. */
  anchor: HTMLElement | null;
}

// "Buy here" first: it's the mark people set by hand most.
const ORDER: OrderPriceColor[] = [...HISTORY_COLORS].sort(
  (a, b) =>
    ['green', 'orange', 'white'].indexOf(a) -
    ['green', 'orange', 'white'].indexOf(b),
);

interface MarkPickerProps {
  target: MarkPickerTarget | undefined;
  onClose: () => void;
  onPick: (color: OrderPriceColor) => void;
}

/**
 * Picks a cell's mark: bottom sheet on phones, a small menu under the dot on
 * desktop. Each mark is a labelled row (swatch + name + what it means), not a
 * bare colour swatch.
 */
export default function MarkPicker({
  target,
  onClose,
  onPick,
}: MarkPickerProps) {
  const t = useTranslations();
  const platform = usePlatform();
  const current = markOf(target?.color);

  const options = (
    <Box className={pc.pickerList} role="radiogroup">
      {ORDER.map((color) => {
        const selected = current === color;
        return (
          <ButtonBase
            key={color}
            disableRipple
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(color)}
            className={`${fontClassName.className} ${pc.pickerOption} ${
              selected ? pc.pickerOptionActive : pc.pickerOptionIdle
            }`}
          >
            <MarkDot color={color} className={pc.pickerDot} />
            <Box className="flex-1 min-w-0">
              <Typography
                className={`${fontClassName.className} ${pc.pickerLabel}`}
              >
                {t(PRICE_MARKS[color].label)}
              </Typography>
              <Typography
                className={`${fontClassName.className} ${pc.pickerHint}`}
              >
                {t(PRICE_MARKS[color].hint)}
              </Typography>
            </Box>
            {selected && <Check className="w-[18px] h-[18px] text-navy" />}
          </ButtonBase>
        );
      })}
    </Box>
  );

  if (platform === 'web') {
    return (
      <Menu
        open={Boolean(target?.anchor)}
        anchorEl={target?.anchor}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ className: pc.menuPaper }}
        MenuListProps={{
          disablePadding: true,
          'aria-label': t('procurementPriceMark'),
        }}
      >
        {options}
      </Menu>
    );
  }

  return (
    <ProcurementSheet
      open={target != null}
      onClose={onClose}
      title={t('procurementPriceMark')}
      subtitle={target && `${target.productName} · ${target.supplierName}`}
      data-testid="price-mark-sheet"
    >
      {options}
    </ProcurementSheet>
  );
}
