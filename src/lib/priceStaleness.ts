// Pure rules for stale-price warnings: no server imports, so both API code
// and pages can use them. Database queries live in ./priceStalenessQueries.

export const STALE_ORANGE_DAYS = 30;
export const STALE_RED_DAYS = 90;

export type StaleTier = 'orange' | 'red' | null;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days elapsed since `date`, floored, never negative. */
export function daysSince(date: Date | string, now: Date = new Date()): number {
  const diff = now.getTime() - new Date(date).getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.floor(diff / MS_PER_DAY);
}

export function staleTierFor(days: number): StaleTier {
  if (days >= STALE_RED_DAYS) return 'red';
  if (days >= STALE_ORANGE_DAYS) return 'orange';
  return null;
}

export function worstTier(tiers: StaleTier[]): StaleTier {
  if (tiers.includes('red')) return 'red';
  if (tiers.includes('orange')) return 'orange';
  return null;
}

export type ProductStaleness = { tier: StaleTier; days: number | null };

/** A product that is stale: what the staff-only stale list holds per product. */
export type StaleProduct = { tier: 'orange' | 'red'; days: number };

/** Age of the oldest linked price; ids missing from the map are ignored. */
export function productStaleness(
  priceIds: string[],
  checkedAtById: Map<string, Date>,
  now: Date = new Date(),
): ProductStaleness {
  let days: number | null = null;
  priceIds.forEach((id) => {
    const checkedAt = checkedAtById.get(id);
    if (!checkedAt) return;
    const d = daysSince(checkedAt, now);
    if (days === null || d > days) days = d;
  });
  return { tier: days === null ? null : staleTierFor(days), days };
}
