import { RAW_RETENTION_DAYS } from '../../../src/lib/analytics/constants';
import { pruneAnalyticsEvents } from '../../../src/lib/analytics/retention';

// 04:30 Ashgabat, well after the 01:30 nightly rollup. The days being pruned
// were finalized ~90 days ago; their rollups are kept.
const DEFAULT_CRON = '30 4 * * *';
const TIMEZONE = 'Asia/Ashgabat';

export async function runAnalyticsRetention(
  now: Date = new Date(),
): Promise<{ deleted: number; batches: number }> {
  const result = await pruneAnalyticsEvents({ now });

  if (result.deleted === 0) {
    console.log(
      `[AnalyticsRetention] No raw events older than ${RAW_RETENTION_DAYS} days.`,
    );
  } else {
    console.log(
      `[AnalyticsRetention] Deleted ${result.deleted} raw event(s) older than ${RAW_RETENTION_DAYS} days in ${result.batches} batch(es).`,
    );
  }
  return result;
}

export const analyticsRetentionJob = {
  id: 'analytics-retention',
  schedule: { type: 'cron' as const, expr: DEFAULT_CRON, timezone: TIMEZONE },
  run: async (): Promise<void> => {
    await runAnalyticsRetention();
  },
};
