import { HistoryPrice } from '@/pages/procurement/lib/types';
import { priceHash } from '@/pages/procurement/lib/utils';

/**
 * Pure helpers for the prices tab: parsing what the user types into a price
 * field, and the summary / filter maths. Kept free of React so they can be
 * unit-tested on their own.
 */

/**
 * Keeps only what can be part of a price while typing: digits and a single
 * decimal separator. Both "." and "," are accepted (Russian keyboards type ",")
 * and the separator the user typed is kept so the field doesn't jump.
 */
export function sanitizePriceInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.,]/g, '');
  const separatorAt = cleaned.search(/[.,]/);
  if (separatorAt === -1) return cleaned;
  return (
    cleaned.slice(0, separatorAt + 1) +
    cleaned.slice(separatorAt + 1).replace(/[.,]/g, '')
  );
}

/**
 * Turns the text of a price field into a value to store.
 * - `null`: the field is empty, i.e. the price was cleared.
 * - `undefined`: not a number yet (e.g. just "." or ","), nothing to save.
 * - a number otherwise. "3,67" and "3.67" both give 3.67 (the old UI used
 *   parseInt and silently dropped the decimals).
 */
export function parsePriceInput(raw: string): number | null | undefined {
  const text = raw.trim();
  if (text === '') return null;
  const normalized = sanitizePriceInput(text).replace(',', '.');
  if (normalized === '' || normalized === '.') return undefined;
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : undefined;
}

/** The text shown in a price field for a stored value. */
export function priceToInput(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

/** 1234.5 -> "1,234.5" (max two decimals) for totals and read-only numbers. */
export function formatAmount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);
}

export const hasPrice = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value);

/** A product is "ordered" when its quantity is above 0. */
export const isOrdered = (quantity: number | null | undefined): boolean =>
  quantity != null && quantity > 0;

export type PricesFilter = 'all' | 'missing' | 'chosen';

interface MatrixInput {
  orderId: string;
  productIds: string[];
  supplierIds: string[];
  prices: HistoryPrice;
  quantities: Record<string, number | null | undefined>;
}

export interface PricesSummary {
  /** Cells of ordered products that have a price. */
  filled: number;
  /** All cells of ordered products (ordered products x suppliers). */
  total: number;
  /** Number of green ("buy here") cells with a price, on ordered products. */
  chosenCount: number;
  /** Sum of quantity x price over those green cells. */
  chosenTotal: number;
  /** Ordered products with at least one supplier price missing. */
  missingProductIds: Set<string>;
  /** Products with at least one green cell. */
  chosenProductIds: Set<string>;
}

/**
 * Counts for the summary card and the filter chips. Only ordered products
 * (quantity > 0) count towards filled/total and the chosen total, the same
 * rule the final "calculated order" download uses.
 */
export function summarizePrices({
  orderId,
  productIds,
  supplierIds,
  prices,
  quantities,
}: MatrixInput): PricesSummary {
  const summary: PricesSummary = {
    filled: 0,
    total: 0,
    chosenCount: 0,
    chosenTotal: 0,
    missingProductIds: new Set(),
    chosenProductIds: new Set(),
  };
  productIds.forEach((productId) => {
    const quantity = quantities[productId];
    const ordered = isOrdered(quantity);
    supplierIds.forEach((supplierId) => {
      const cell = prices[priceHash({ orderId, productId, supplierId })];
      const priced = hasPrice(cell?.value);
      if (cell?.color === 'green' && priced) {
        summary.chosenProductIds.add(productId);
      }
      if (!ordered) return;
      summary.total += 1;
      if (priced) summary.filled += 1;
      else summary.missingProductIds.add(productId);
      if (cell?.color === 'green' && priced) {
        summary.chosenCount += 1;
        summary.chosenTotal += (quantity as number) * cell.value;
      }
    });
  });
  return summary;
}

/** Whether a product is shown under the given filter chip. */
export function matchesFilter(
  filter: PricesFilter,
  productId: string,
  summary: Pick<PricesSummary, 'missingProductIds' | 'chosenProductIds'>,
): boolean {
  if (filter === 'missing') return summary.missingProductIds.has(productId);
  if (filter === 'chosen') return summary.chosenProductIds.has(productId);
  return true;
}
