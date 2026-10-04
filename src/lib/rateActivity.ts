import {
  changedFields,
  FieldChange,
  logAdminActivity,
} from '@/lib/adminActivity';
import type { DollarRate } from '@prisma/client';

type RateSnapshot = Pick<DollarRate, 'id' | 'name' | 'rate' | 'currency'>;

export function recordRateCreated(
  userId: string | undefined,
  rate: RateSnapshot,
): void {
  logAdminActivity({
    userId,
    entity: 'CURRENCY_RATE',
    action: 'CREATE',
    targetId: String(rate.id),
    meta: { name: rate.name, currency: rate.currency, rate: rate.rate },
  });
}

/**
 * One row for the whole change. A rate edit rewrites hundreds of prices
 * internally, but that is one decision, recorded with how many it moved.
 */
export function recordRateUpdated(
  userId: string | undefined,
  before: RateSnapshot | null,
  after: RateSnapshot,
  recalculatedPrices: number | null,
): void {
  const changes: Record<string, FieldChange> = before
    ? changedFields(before, after, ['name', 'rate'])
    : { rate: { from: null, to: after.rate } };
  if (Object.keys(changes).length === 0) return;
  logAdminActivity({
    userId,
    entity: 'CURRENCY_RATE',
    action: 'UPDATE',
    targetId: String(after.id),
    meta: {
      name: after.name,
      currency: after.currency,
      changes,
      ...(recalculatedPrices != null && recalculatedPrices > 0
        ? { recalculatedPrices }
        : {}),
    },
  });
}

export function recordRateDeleted(
  userId: string | undefined,
  rate: RateSnapshot,
  reassignedPrices: number,
): void {
  logAdminActivity({
    userId,
    entity: 'CURRENCY_RATE',
    action: 'DELETE',
    targetId: String(rate.id),
    meta: {
      name: rate.name,
      currency: rate.currency,
      rate: rate.rate,
      ...(reassignedPrices > 0 ? { reassignedPrices } : {}),
    },
  });
}
