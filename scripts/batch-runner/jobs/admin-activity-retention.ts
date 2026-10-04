import {
  ADMIN_ACTIVITY_RETENTION_MONTHS,
  pruneAdminActivity,
} from '../../../src/lib/adminActivityRetention';

const DEFAULT_CRON = '0 5 * * *'; // 05:00 daily, after the 03:00-04:00 jobs

async function runAdminActivityRetention(): Promise<void> {
  const { deleted, batches } = await pruneAdminActivity();

  if (deleted === 0) {
    console.log(
      `[AdminActivityRetention] No activity older than ${ADMIN_ACTIVITY_RETENTION_MONTHS} months.`,
    );
    return;
  }

  console.log(
    `[AdminActivityRetention] Deleted ${deleted} activity row(s) older than ${ADMIN_ACTIVITY_RETENTION_MONTHS} months in ${batches} batch(es).`,
  );
}

export const adminActivityRetentionJob = {
  id: 'admin-activity-retention',
  schedule: { type: 'cron' as const, expr: DEFAULT_CRON },
  run: runAdminActivityRetention,
};
