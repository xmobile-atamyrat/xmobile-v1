import { Platform } from '@/pages/lib/PlatformContext';
import {
  markOf,
  PRICE_MARKS,
} from '@/pages/procurement/components/prices/marks';
import {
  priceMarkClasses,
  pricesClasses as pc,
} from '@/styles/classMaps/procurement/prices';
import { fontClassName } from '@/styles/theme';
import { ButtonBase } from '@mui/material';
import { OrderPriceColor } from '@prisma/client';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MouseEvent } from 'react';

interface PriceFieldProps {
  platform: Platform;
  value: string;
  color: OrderPriceColor | null | undefined;
  /** Shown inside the field on phones ("USD"). */
  currency?: string;
  ariaLabel: string;
  onChange: (raw: string) => void;
  onBlur: () => void;
}

/**
 * The price input: text field with the decimal keypad (no spin buttons),
 * accepts "," or "." as the separator. The border picks up the cell's mark.
 */
export function PriceField({
  platform,
  value,
  color,
  currency,
  ariaLabel,
  onChange,
  onBlur,
}: PriceFieldProps) {
  return (
    <label
      className={`${pc.field[platform]} ${priceMarkClasses[markOf(color)].field}`}
    >
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="next"
        placeholder="—"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`${fontClassName.className} ${
          platform === 'mobile' ? pc.fieldInput : pc.fieldInputWeb
        }`}
      />
      {currency && (
        <span className={`${fontClassName.className} ${pc.fieldSuffix}`}>
          {currency}
        </span>
      )}
    </label>
  );
}

/** Round swatch for a mark; green carries a check so it reads without colour. */
export function MarkDot({
  color,
  className = pc.markDot,
}: {
  color: OrderPriceColor | null | undefined;
  className?: string;
}) {
  const mark = markOf(color);
  return (
    <span className={`${className} ${priceMarkClasses[mark].dot}`} aria-hidden>
      {mark === 'green' && <Check className="w-3 h-3" strokeWidth={3} />}
    </span>
  );
}

interface MarkButtonProps {
  platform: Platform;
  color: OrderPriceColor | null | undefined;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

/** Opens the mark picker for one cell. */
export function MarkButton({
  platform,
  color,
  disabled,
  onClick,
}: MarkButtonProps) {
  const t = useTranslations();
  return (
    <ButtonBase
      disableRipple
      disabled={disabled}
      onClick={onClick}
      className={pc.markBtn[platform]}
      aria-haspopup="dialog"
      aria-label={`${t('procurementPriceMark')}: ${t(
        PRICE_MARKS[markOf(color)].label,
      )}`}
    >
      <MarkDot color={color} />
    </ButtonBase>
  );
}
