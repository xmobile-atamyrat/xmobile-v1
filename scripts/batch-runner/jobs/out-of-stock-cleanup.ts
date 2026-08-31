import { retireLongOutOfStockProducts } from '../../../src/lib/outOfStock';

const DEFAULT_CRON = '0 4 * * *'; // 04:00 daily, after out-of-stock-sync
const RETENTION_DAYS = 365;

/**
 * Retires products that have sat out of stock for over a year.
 *
 * Runs after out-of-stock-sync so a product the reconcile just marked out of
 * stock is judged on a fresh `outOfStockAt` rather than a stale one — though in
 * practice a product marked out of stock today is a year away from mattering
 * here.
 */
async function runOutOfStockCleanup(): Promise<void> {
  const { retired, skippedWithActiveBanner } =
    await retireLongOutOfStockProducts(RETENTION_DAYS);

  if (retired === 0 && skippedWithActiveBanner === 0) {
    console.log(
      `[OutOfStockCleanup] No products out of stock for longer than ${RETENTION_DAYS} days.`,
    );
    return;
  }

  console.log(
    `[OutOfStockCleanup] Retired ${retired} product(s) out of stock for over ${RETENTION_DAYS} days.`,
  );
  if (skippedWithActiveBanner > 0) {
    console.log(
      `[OutOfStockCleanup] Skipped ${skippedWithActiveBanner} product(s) still targeted by an active promo banner.`,
    );
  }
}

export const outOfStockCleanupJob = {
  id: 'out-of-stock-cleanup',
  schedule: { type: 'cron' as const, expr: DEFAULT_CRON },
  run: runOutOfStockCleanup,
};
