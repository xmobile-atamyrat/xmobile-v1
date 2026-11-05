import { markOf } from '@/pages/procurement/components/prices/marks';
import {
  MarkButton,
  PriceField,
} from '@/pages/procurement/components/prices/PriceCell';
import { PricesViewProps } from '@/pages/procurement/components/prices/PricesCards';
import { hasPrice, isOrdered } from '@/pages/procurement/lib/priceInput';
import { procurementClasses as c } from '@/styles/classMaps/procurement';
import {
  priceMarkClasses,
  pricesClasses as pc,
} from '@/styles/classMaps/procurement/prices';
import { fontClassName } from '@/styles/theme';
import { Box, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';

/**
 * Desktop: the products x suppliers matrix. The card scrolls on its own (both
 * ways) so the page never does; the supplier header row and the product
 * column stay pinned while scrolling.
 */
export default function PricesTable({
  products,
  suppliers,
  prices,
  quantities,
  currency,
  editing,
  onEdited,
  onOpenPicker,
}: Omit<PricesViewProps, 'expanded' | 'onToggleExpanded'>) {
  const t = useTranslations();
  const font = fontClassName.className;

  return (
    <Box className={c.cardWeb}>
      <Box className={pc.tableScroll}>
        <table className={`${font} ${pc.table}`}>
          <thead>
            <tr>
              <th scope="col" className={pc.thCorner}>
                <span className={pc.thText}>
                  {t('product')} · {currency}
                </span>
              </th>
              {suppliers.map((supplier) => (
                <th
                  key={supplier.id}
                  scope="col"
                  className={pc.th}
                  title={supplier.name}
                >
                  <span className={pc.thText}>{supplier.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const quantity = quantities[product.id];
              const ordered = isOrdered(quantity);
              return (
                <tr key={product.id} data-testid="price-product-row">
                  <th scope="row" className={pc.tdProduct}>
                    <Typography
                      className={`${font} ${pc.tdProductName} ${
                        ordered ? '' : 'text-muted'
                      }`}
                    >
                      {product.name}
                    </Typography>
                    <Typography className={`${font} ${pc.tdProductMeta}`}>
                      {ordered
                        ? t('procurementQtyShort', { count: quantity })
                        : t('procurementNotOrdered')}
                    </Typography>
                  </th>
                  {suppliers.map((supplier) => {
                    const cell = {
                      productId: product.id,
                      supplierId: supplier.id,
                    };
                    const price = prices[editing.hashOf(cell)];
                    const mark = markOf(price?.color);
                    return (
                      <td
                        key={supplier.id}
                        data-mark={mark}
                        className={`${pc.td} ${priceMarkClasses[mark].tint}`}
                      >
                        <Box
                          className={`${pc.tdInner} ${
                            ordered ? '' : pc.rowDimmed
                          }`}
                        >
                          <PriceField
                            platform="web"
                            value={editing.inputValue(cell)}
                            color={price?.color}
                            ariaLabel={`${supplier.name}, ${product.name}`}
                            onChange={(raw) => {
                              onEdited(product.id);
                              editing.changePrice(cell, raw);
                            }}
                            onBlur={() => editing.commitPrice(cell)}
                          />
                          <MarkButton
                            platform="web"
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
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>
    </Box>
  );
}
