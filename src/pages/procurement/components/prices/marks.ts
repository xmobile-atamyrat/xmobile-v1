import { OrderPriceColor } from '@prisma/client';

/**
 * The three price marks (`HISTORY_COLORS`), labelled in words. Only green
 * cells go into the final "calculated order" files; "Calculate" marks the
 * cheapest price green and the most expensive one orange.
 */
export const PRICE_MARKS: Record<
  OrderPriceColor,
  { label: string; hint: string }
> = {
  white: {
    label: 'procurementMarkNone',
    hint: 'procurementMarkNoneHint',
  },
  orange: {
    label: 'procurementMarkFlagged',
    hint: 'procurementMarkFlaggedHint',
  },
  green: {
    label: 'procurementMarkBuy',
    hint: 'procurementMarkBuyHint',
  },
};

/** `undefined` / null colour means "no mark". */
export const markOf = (color: OrderPriceColor | null | undefined) =>
  color ?? OrderPriceColor.white;
