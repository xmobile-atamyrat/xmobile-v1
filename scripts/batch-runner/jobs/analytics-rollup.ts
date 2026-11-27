import { catchUp, rollupDay } from '../../../src/lib/analytics/rollup';
import {
  LATE_EVENTS_GRACE_MS,
  localDay,
  shiftDay,
} from '../../../src/lib/analytics/time';

/** Every 10 minutes (an interval job also runs once at start-up). */
export const ANALYTICS_ROLLUP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * During this long after Ashgabat midnight yesterday is recomputed too, so
 * events that reach the database late (beacons flushed on the next page
 * load, the 5s server buffer) still land in their own day.
 */
export { LATE_EVENTS_GRACE_MS };

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

/**
 * Recomputes today (and yesterday right after midnight). With `catchUp`
 * (the first run after start-up), first heals what a crash or redeploy may
 * have left: the last CATCH_UP_DAYS days, the week/month rows missing for
 * periods that ended meanwhile, and revenue for all days. Then only today
 * is left to roll up.
 */
export async function runAnalyticsRollup(
  now: Date = new Date(),
  options: { catchUp?: boolean } = {},
): Promise<string[]> {
  let days = daysToRollup(now);
  if (options.catchUp) {
    const healed = await catchUp({ now, onlyMissingPeriods: true });
    console.log(
      `[AnalyticsRollup] Start-up catch-up: re-rolled ${healed.from}..${healed.to}.`,
    );
    days = days.filter((day) => day > healed.to);
  }
  // One day at a time: each is its own transaction.
  // eslint-disable-next-line no-restricted-syntax
  for (const day of days) {
    // eslint-disable-next-line no-await-in-loop
    await rollupDay(day, { now });
  }
  console.log(`[AnalyticsRollup] Rolled up ${days.join(', ')}.`);
  return days;
}

/** The job, with the start-up catch-up pending until a run succeeds. */
export function createAnalyticsRollupJob() {
  let caughtUp = false;
  return {
    id: 'analytics-rollup',
    schedule: { type: 'interval' as const, ms: ANALYTICS_ROLLUP_INTERVAL_MS },
    run: async (): Promise<void> => {
      await runAnalyticsRollup(new Date(), { catchUp: !caughtUp });
      caughtUp = true;
    },
  };
}

export const analyticsRollupJob = createAnalyticsRollupJob();
