import { syncAllProductsOutOfStock } from '../../../src/lib/outOfStock';

const DEFAULT_CRON = '30 3 * * *'; // 03:30 daily, after account-deletion

/**
 * Reconciles every active product's out-of-stock flag against the prices it
 * owns. The API already re-derives a product whenever one of its prices is
 * edited, so on a healthy database this job finds nothing; it exists to catch
 * the writes that bypass that path — bulk imports, manual SQL, a request that
 * died between the price write and the resync.
 */
async function runOutOfStockSync(): Promise<void> {
  const { markedOutOfStock, markedInStock } = await syncAllProductsOutOfStock();

  if (markedOutOfStock === 0 && markedInStock === 0) {
    console.log('[OutOfStockSync] All products already match their prices.');
    return;
  }

  console.log(
    `[OutOfStockSync] Marked ${markedOutOfStock} product(s) out of stock and ${markedInStock} back in stock.`,
  );
}

export const outOfStockSyncJob = {
  id: 'out-of-stock-sync',
  schedule: { type: 'cron' as const, expr: DEFAULT_CRON },
  run: runOutOfStockSync,
};
