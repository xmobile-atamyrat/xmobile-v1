import { squareBracketRegex } from '@/pages/lib/constants';
import {
  PriceRowLike,
  regularPriceOf,
  salePercentOf,
} from '@/pages/lib/priceDisplay';
import { ProductSale } from '@/pages/lib/types';
import { parseVariantTag } from '@/pages/product/utils';

// The same shape as the base price's sale: the normal price and the percent off.
export type VariantSale = NonNullable<ProductSale['base']>;

export interface SaleVariantChoice {
  priceId?: string;
  isOutOfStock: boolean;
  sale: VariantSale | null;
}

/** Null when the price row is missing or has no active sale. */
export const variantSaleOf = (
  row: PriceRowLike | null | undefined,
): VariantSale | null => {
  if (row == null) return null;
  const percent = salePercentOf(row);
  return percent == null ? null : { oldPrice: regularPriceOf(row), percent };
};

/** The price id a stored product price ("[id]{value}") points at. */
export const basePriceIdOf = (
  price: string | null | undefined,
): string | undefined => price?.match(squareBracketRegex)?.[1];

/**
 * The tag a quick-add buys: the one at `productPrice`'s price id, else the first.
 * Pass the price only when that row is known to be in stock.
 */
export const quickAddTagOf = (
  tags: string[] | null | undefined,
  productPrice: string | null | undefined,
): string | undefined => {
  const basePriceId = basePriceIdOf(productPrice);
  const matching =
    basePriceId == null
      ? undefined
      : tags?.find((tag) => parseVariantTag(tag).priceId === basePriceId);
  return matching ?? tags?.[0];
};

/**
 * The variant the product page opens on. Only in-stock variants count as being
 * on sale. In order: the one on sale at the base price; the first in-stock one
 * if it is on sale; the biggest discount; the first in-stock one; the first.
 */
export const pickDefaultVariant = <T extends SaleVariantChoice>(
  variants: T[],
  basePriceId?: string,
): T | undefined => {
  const inStock = variants.filter((variant) => !variant.isOutOfStock);
  const onSale = inStock.filter((variant) => variant.sale != null);

  const baseOnSale = onSale.find(
    (variant) => basePriceId != null && variant.priceId === basePriceId,
  );
  if (baseOnSale != null) return baseOnSale;

  if (inStock[0]?.sale != null) return inStock[0];

  // Ties keep the earlier variant.
  const biggest = onSale.reduce<T | undefined>(
    (best, variant) =>
      best == null || variant.sale!.percent > best.sale!.percent
        ? variant
        : best,
    undefined,
  );

  return biggest ?? inStock[0] ?? variants[0];
};
