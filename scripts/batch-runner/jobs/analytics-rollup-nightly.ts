import {
  refreshOrderOutcomes,
  rollupDay,
  rollupPeriodUniques,
} from '../../../src/lib/analytics/rollup';
import {
  localDay,
  rawWindowStart,
  shiftDay,
} from '../../../src/lib/analytics/time';

// 01:30 Ashgabat: after the 10-minute job's one-hour grace for yesterday, so
// late events are in. The time zone is explicit because node-cron otherwise
// uses the VM's.
const DEFAULT_CRON = '30 1 * * *';
const TIMEZONE = 'Asia/Ashgabat';

/**
 * Finalizes yesterday, its ISO week's and month's unique visitors, and
 * refreshes the order-based rows (revenue, completed orders, the funnel's last
 * step) of every earlier day still in the raw window, since orders keep
 * changing status after the day they were placed.
 */
export async function runAnalyticsRollupNightly(
  now: Date = new Date(),
): Promise<{ yesterday: string; refreshedFrom: string; refreshedTo: string }> {
  const yesterday = shiftDay(localDay(now), -1);
  await rollupDay(yesterday, { now });
  await rollupPeriodUniques(yesterday, { now });

  const refreshedFrom = rawWindowStart(now);
  const refreshedTo = shiftDay(yesterday, -1);
  await refreshOrderOutcomes(refreshedFrom, refreshedTo, { now });

  console.log(
    `[AnalyticsRollupNightly] Finalized ${yesterday}; refreshed order outcomes ${refreshedFrom}..${refreshedTo}.`,
  );
  return { yesterday, refreshedFrom, refreshedTo };
}

export const analyticsRollupNightlyJob = {
  id: 'analytics-rollup-nightly',
  schedule: { type: 'cron' as const, expr: DEFAULT_CRON, timezone: TIMEZONE },
  run: async (): Promise<void> => {
    await runAnalyticsRollupNightly();
  },
};
