import { HistoryPrice } from '@/pages/procurement/lib/types';
import { priceHash } from '@/pages/procurement/lib/utils';

export interface SupplierStats {
  /** Products to buy (quantity > 0) that this supplier has a price for. */
  priced: number;
  /** Products to buy (quantity > 0). Same for every supplier. */
  total: number;
  /** Of those, how many this supplier is the cheapest for (green cells). */
  cheapest: number;
}

export interface OrderSupplierStats {
  bySupplier: Record<string, SupplierStats>;
  /** True once "calculate" has run, i.e. any cell in the order is green. */
  calculated: boolean;
}

const hasValue = (value: number | null | undefined) =>
  value != null && !Number.isNaN(value);

/**
 * Per-supplier summary for the Suppliers tab: how many of the products we are
 * buying each store has priced, and (after calculation) how many it is the
 * cheapest for. Products whose quantity is empty or 0 are not being bought,
 * so they count towards neither number.
 */
export function getSupplierStats({
  orderId,
  supplierIds,
  productIds,
  quantities,
  prices,
}: {
  orderId: string;
  supplierIds: string[];
  productIds: string[];
  /** productId -> quantity (null while the field is empty). */
  quantities: Record<string, number | null | undefined>;
  prices: HistoryPrice;
}): OrderSupplierStats {
  const buying = productIds.filter((id) => (quantities[id] ?? 0) > 0);
  let calculated = false;
  const bySupplier: Record<string, SupplierStats> = {};

  supplierIds.forEach((supplierId) => {
    let priced = 0;
    let cheapest = 0;
    productIds.forEach((productId) => {
      const cell = prices[priceHash({ orderId, productId, supplierId })];
      if (cell?.color === 'green') calculated = true;
    });
    buying.forEach((productId) => {
      const cell = prices[priceHash({ orderId, productId, supplierId })];
      if (cell == null) return;
      if (hasValue(cell.value)) priced += 1;
      if (cell.color === 'green') cheapest += 1;
    });
    bySupplier[supplierId] = { priced, total: buying.length, cheapest };
  });

  return { bySupplier, calculated };
}

/** The price cells of `supplierId` that exist in `prices` (to delete on removal). */
export function supplierPriceIds({
  orderId,
  supplierId,
  productIds,
  prices,
}: {
  orderId: string;
  supplierId: string;
  productIds: string[];
  prices: HistoryPrice;
}): { orderId: string; productId: string; supplierId: string }[] {
  return productIds
    .map((productId) => ({ orderId, productId, supplierId }))
    .filter((ids) => prices[priceHash(ids)] != null);
}

/** A copy of `prices` without any of `supplierId`'s cells in this order. */
export function withoutSupplierPrices({
  orderId,
  supplierId,
  productIds,
  prices,
}: {
  orderId: string;
  supplierId: string;
  productIds: string[];
  prices: HistoryPrice;
}): HistoryPrice {
  const next = { ...prices };
  productIds.forEach((productId) => {
    delete next[priceHash({ orderId, productId, supplierId })];
  });
  return next;
}
