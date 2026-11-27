import type { Prisma } from '@prisma/client';

import { detachAnalyticsFromUsers } from '../../../src/lib/analytics/server/userData';
import dbClient from '../../../src/lib/dbClient';

const DEFAULT_CRON = '0 3 * * *'; // 03:00 daily
const GRACE_PERIOD_DAYS = 90;
/** Accounts per transaction. */
const BATCH_SIZE = 500;

async function runAccountDeletion(): Promise<void> {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const expiredWhere: Prisma.UserWhereInput = {
    deletedAt: { not: null, lt: cutoff },
  };

  const expired = await dbClient.user.findMany({
    where: expiredWhere,
    select: { id: true },
  });

  let count = 0;
  for (let i = 0; i < expired.length; i += BATCH_SIZE) {
    const ids = expired.slice(i, i + BATCH_SIZE).map(({ id }) => id);
    // One transaction, so an account is never gone while its events still
    // name it. (Array form: no interactive-transaction timeout on a big
    // events table.)
    // eslint-disable-next-line no-await-in-loop
    const [, deleted] = await dbClient.$transaction([
      detachAnalyticsFromUsers(dbClient, ids),
      dbClient.user.deleteMany({ where: { ...expiredWhere, id: { in: ids } } }),
    ]);
    count += deleted.count;
  }

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
