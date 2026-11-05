import {
  markOf,
  PRICE_MARKS,
} from '@/pages/procurement/components/prices/marks';
import { MarkPickerTarget } from '@/pages/procurement/components/prices/MarkPicker';
import {
  MarkButton,
  PriceField,
} from '@/pages/procurement/components/prices/PriceCell';
import { usePriceEditing } from '@/pages/procurement/components/prices/usePriceEditing';
import { hasPrice, isOrdered } from '@/pages/procurement/lib/priceInput';
import { HistoryPrice } from '@/pages/procurement/lib/types';
import {
  priceMarkClasses,
  pricesClasses as pc,
} from '@/styles/classMaps/procurement/prices';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, Typography } from '@mui/material';
import { ProcurementProduct, ProcurementSupplier } from '@prisma/client';
import { CheckCircle2, ChevronDown, ChevronUp, Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface PricesViewProps {
  products: ProcurementProduct[];
  suppliers: ProcurementSupplier[];
  prices: HistoryPrice;
  quantities: Record<string, number | null>;
  currency: string;
  editing: ReturnType<typeof usePriceEditing>;
  onEdited: (productId: string) => void;
  onOpenPicker: (target: MarkPickerTarget) => void;
  expanded: Set<string>;
  onToggleExpanded: (productId: string) => void;
}

/**
 * Phones: one card per product (name wraps, "qty N" under it), one row per
 * supplier with the price field and the mark button. "Buy here" rows get a
 * light green tint and a check; flagged rows a light amber tint. Products
 * that aren't ordered (quantity 0/empty) collapse to a dimmed row.
 */
export default function PricesCards({
  products,
  suppliers,
  prices,
  quantities,
  currency,
  editing,
  onEdited,
  onOpenPicker,
  expanded,
  onToggleExpanded,
}: PricesViewProps) {
  const t = useTranslations();
  const font = fontClassName.className;

  return (
    <Box className={pc.list}>
      {products.map((product) => {
        const quantity = quantities[product.id];
        const ordered = isOrdered(quantity);
        const open = ordered || expanded.has(product.id);
        const Chevron = open ? ChevronUp : ChevronDown;

        return (
          <Box
            key={product.id}
            component="section"
            aria-label={product.name}
            className={ordered ? pc.card : pc.cardDimmed}
            data-testid="price-product-card"
          >
            {ordered ? (
              <Box className={pc.cardHead}>
                <Box className="flex-1 min-w-0">
                  <Typography className={`${font} ${pc.cardTitle}`}>
                    {product.name}
                  </Typography>
                  <Typography className={`${font} ${pc.cardMeta}`}>
                    {t('procurementQtyShort', { count: quantity })}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <ButtonBase
                disableRipple
                aria-expanded={open}
                onClick={() => onToggleExpanded(product.id)}
                className={`${font} ${pc.collapsedBtn}`}
              >
                <Box className="flex-1 min-w-0">
                  <Typography className={`${font} ${pc.collapsedTitle}`}>
                    {product.name}
                  </Typography>
                  <Typography className={`${font} ${pc.notOrdered}`}>
                    {t('procurementNotOrdered')}
                  </Typography>
                </Box>
                <Chevron className="w-[18px] h-[18px] text-muted flex-none" />
              </ButtonBase>
            )}

            {open &&
              suppliers.map((supplier) => {
                const cell = { productId: product.id, supplierId: supplier.id };
                const price = prices[editing.hashOf(cell)];
                const mark = markOf(price?.color);
                return (
                  <Box
                    key={supplier.id}
                    className={`${pc.row} ${priceMarkClasses[mark].tint}`}
                    data-mark={mark}
                  >
                    <Box className={pc.rowSupplier}>
                      <Typography
                        title={supplier.name}
                        className={`${font} ${pc.rowName} ${
                          mark === 'green' ? pc.rowNameChosen : ''
                        }`}
                      >
                        {supplier.name}
                      </Typography>
                      {mark !== 'white' && (
                        <Typography
                          className={`${font} ${pc.rowMark} ${priceMarkClasses[mark].label}`}
                        >
                          {mark === 'green' ? (
                            <CheckCircle2 className="w-[13px] h-[13px]" />
                          ) : (
                            <Flag className="w-3 h-3" />
                          )}
                          {t(PRICE_MARKS[mark].label)}
                        </Typography>
                      )}
                    </Box>
                    <PriceField
                      platform="mobile"
                      value={editing.inputValue(cell)}
                      color={price?.color}
                      currency={currency}
                      ariaLabel={`${supplier.name}, ${product.name}`}
                      onChange={(raw) => {
                        onEdited(product.id);
                        editing.changePrice(cell, raw);
                      }}
                      onBlur={() => editing.commitPrice(cell)}
                    />
                    <MarkButton
                      platform="mobile"
                      color={price?.color}
                      disabled={!hasPrice(price?.value)}
                      onClick={(e) =>
                        onOpenPicker({
                          ...cell,
                          productName: product.name,
                          supplierName: supplier.name,
                          color: price?.color,
                          anchor: e.currentTarget,
                        })
                      }
                    />
                  </Box>
                );
              })}
          </Box>
        );
      })}
    </Box>
  );
}
