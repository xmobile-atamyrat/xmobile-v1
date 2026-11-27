import { catchUp, refreshFunnel } from '../../../src/lib/analytics/rollup';
import { rawWindowStart, shiftDay } from '../../../src/lib/analytics/time';

// 01:30 Ashgabat: after the 10-minute job's one-hour grace for yesterday, so
// late events are in. The time zone is explicit because node-cron otherwise
// uses the VM's.
const DEFAULT_CRON = '30 1 * * *';
const TIMEZONE = 'Asia/Ashgabat';

/**
 * Nightly finalization, written so that a missed night heals on the next:
 * - re-rolls every metric of the last CATCH_UP_DAYS days (yesterday
 *   included) and recounts the week/month uniques of the periods touching
 *   them, so the period that just ended gets its final row even if the run
 *   on its closing night was missed;
 * - recomputes revenue and completed orders of every day from UserOrder;
 * - refreshes the funnel (whose last step follows orders' current status)
 *   of the older days still in the raw window.
 */
export async function runAnalyticsRollupNightly(
  now: Date = new Date(),
): Promise<{
  rerolledFrom: string;
  rerolledTo: string;
  funnelFrom: string;
  funnelTo: string;
}> {
  const { from, to } = await catchUp({ now });
  const funnelFrom = rawWindowStart(now);
  const funnelTo = shiftDay(from, -1);
  await refreshFunnel(funnelFrom, funnelTo, { now });

  console.log(
    `[AnalyticsRollupNightly] Re-rolled ${from}..${to} and their weeks/months; refreshed revenue for all days and the funnel of ${funnelFrom}..${funnelTo}.`,
  );
  return { rerolledFrom: from, rerolledTo: to, funnelFrom, funnelTo };
}

export const analyticsRollupNightlyJob = {
  id: 'analytics-rollup-nightly',
  schedule: { type: 'cron' as const, expr: DEFAULT_CRON, timezone: TIMEZONE },
  run: async (): Promise<void> => {
    await runAnalyticsRollupNightly();
  },
};
