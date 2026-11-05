import { Platform } from '@/pages/lib/PlatformContext';
import {
  isMissingQuantity,
  MAX_QUANTITY_DIGITS,
  parseQuantityInput,
} from '@/pages/procurement/components/products/quantity';
import { QuantitySaveStatus } from '@/pages/procurement/components/products/useQuantitySaver';
import { procurementNumberFieldSx } from '@/styles/classMaps/procurement';
import {
  productsPanelClasses as c,
  zeroQuantityFieldSx,
} from '@/styles/classMaps/procurement/products';
import { fontClassName } from '@/styles/theme';
import { ButtonBase, TextField, Typography } from '@mui/material';
import { ProcurementProduct } from '@prisma/client';
import { Check, Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { memo } from 'react';

interface ProductRowProps {
  product: ProcurementProduct;
  /** 1-based position in the order (desktop index column). */
  position: number;
  quantity: number | null | undefined;
  status: QuantitySaveStatus | undefined;
  platform: Platform;
  isLast: boolean;
  onQuantityChange: (productId: string, quantity: number | null) => void;
  onQuantityBlur: (productId: string) => void;
  onRemove: (product: ProcurementProduct) => void;
}

const quantityFieldSx = {
  ...procurementNumberFieldSx,
  '& .MuiInputBase-input': {
    ...procurementNumberFieldSx['& .MuiInputBase-input'],
    textAlign: 'center',
    fontWeight: 600,
    // Onest's tabular "1" is padded wide ("1 5"); quantities read better
    // with proportional digits and nothing lines up across rows anyway.
    fontVariantNumeric: 'normal',
  },
};

function RowMeta({
  status,
  missing,
}: {
  status: QuantitySaveStatus | undefined;
  missing: boolean;
}) {
  const t = useTranslations();
  if (status === 'saving') {
    return (
      <span className={c.meta}>
        <Loader2 className={c.metaSpin} aria-hidden />
        {t('procurementSaving')}
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className={`${c.meta} ${c.metaSaved}`}>
        <Check className={c.metaIcon} aria-hidden />
        {t('procurementSaved')}
      </span>
    );
  }
  if (missing) {
    return (
      <span className={`${c.meta} ${c.metaZero}`}>
        {t('procurementNoQuantity')}
      </span>
    );
  }
  return null;
}

function ProductRow({
  product,
  position,
  quantity,
  status,
  platform,
  isLast,
  onQuantityChange,
  onQuantityBlur,
  onRemove,
}: ProductRowProps) {
  const t = useTranslations();
  const missing = isMissingQuantity(quantity);

  return (
    <li
      className={`${c.row[platform]} ${isLast ? '' : c.rowBorder} ${
        missing ? c.rowZero : ''
      }`}
      data-testid="procurement-product-row"
    >
      {platform === 'web' && (
        <span className={`${fontClassName.className} ${c.index}`}>
          {position}
        </span>
      )}
      <div className={c.nameCol}>
        <Typography className={`${fontClassName.className} ${c.name}`}>
          {product.name}
        </Typography>
        <RowMeta status={status} missing={missing} />
      </div>
      <TextField
        value={quantity ?? ''}
        placeholder="0"
        onChange={(e) =>
          onQuantityChange(product.id, parseQuantityInput(e.target.value))
        }
        onBlur={() => onQuantityBlur(product.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className={c.qty[platform]}
        sx={
          missing
            ? { ...quantityFieldSx, ...zeroQuantityFieldSx }
            : quantityFieldSx
        }
        inputProps={{
          inputMode: 'numeric',
          pattern: '[0-9]*',
          maxLength: MAX_QUANTITY_DIGITS,
          enterKeyHint: 'done',
          'aria-label': `${t('quantity')}: ${product.name}`,
          className: fontClassName.className,
        }}
      />
      <ButtonBase
        disableRipple
        aria-label={`${t('remove')}: ${product.name}`}
        onClick={() => onRemove(product)}
        className={c.removeBtn}
      >
        <Trash2 className="w-[18px] h-[18px]" aria-hidden />
      </ButtonBase>
    </li>
  );
}

export default memo(ProductRow);
