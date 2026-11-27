import { rollupDay } from '../../../src/lib/analytics/rollup';
import { localDay, shiftDay } from '../../../src/lib/analytics/time';

/** Every 10 minutes (an interval job also runs once at start-up). */
export const ANALYTICS_ROLLUP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * During this long after Ashgabat midnight yesterday is recomputed too, so
 * events that reach the database late (beacons flushed on the next page
 * load, the 5s server buffer) still land in their own day.
 */
export const LATE_EVENTS_GRACE_MS = 60 * 60 * 1000;

const ASHGABAT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** The Ashgabat days the 10-minute rollup recomputes at `now`. */
export function daysToRollup(now: Date): string[] {
  const today = localDay(now);
  const sinceMidnight =
    (now.getTime() + ASHGABAT_OFFSET_MS) % (24 * 60 * 60 * 1000);
  return sinceMidnight < LATE_EVENTS_GRACE_MS
    ? [shiftDay(today, -1), today]
    : [today];
}

export async function runAnalyticsRollup(
  now: Date = new Date(),
): Promise<string[]> {
  const days = daysToRollup(now);
  // One day at a time: each is its own transaction.
  // eslint-disable-next-line no-restricted-syntax
  for (const day of days) {
    // eslint-disable-next-line no-await-in-loop
    await rollupDay(day, { now });
  }
  console.log(`[AnalyticsRollup] Rolled up ${days.join(', ')}.`);
  return days;
}

export const analyticsRollupJob = {
  id: 'analytics-rollup',
  schedule: { type: 'interval' as const, ms: ANALYTICS_ROLLUP_INTERVAL_MS },
  run: async (): Promise<void> => {
    await runAnalyticsRollup();
  },
};
