import dbClient from '../../../src/lib/dbClient';

const DEFAULT_CRON = '0 3 * * *'; // 03:00 daily
const GRACE_PERIOD_DAYS = 90;

async function runAccountDeletion(): Promise<void> {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const { count } = await dbClient.user.deleteMany({
    where: { deletedAt: { not: null, lt: cutoff } },
  });

  if (count > 0) {
    console.log(
      `[AccountDeletion] Permanently deleted ${count} expired soft-deleted account(s) (cutoff: ${cutoff.toISOString()}).`,
    );
  } else {
    console.log('[AccountDeletion] No expired accounts to purge.');
  }
}

export const accountDeletionJob = {
  id: 'account-deletion',
  schedule: { type: 'cron' as const, expr: DEFAULT_CRON },
  run: runAccountDeletion,
};
