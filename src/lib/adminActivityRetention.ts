import dbClient from '@/lib/dbClient';
import { Prisma } from '@prisma/client';

export const ADMIN_ACTIVITY_RETENTION_MONTHS = 13;

const DEFAULT_BATCH_SIZE = 1000;
// One run removes at most 200k rows. A backlog bigger than that just takes a
// few nights, which beats one run holding the 4 GB VM's database busy.
const DEFAULT_MAX_BATCHES = 200;

export function retentionCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - ADMIN_ACTIVITY_RETENTION_MONTHS);
  return cutoff;
}

/**
 * Deletes activity older than the retention window in small batches. Postgres
 * has no `DELETE ... LIMIT`, so each batch picks its ids from the
 * `createdAt` index first.
 */
export async function pruneAdminActivity({
  now = new Date(),
  batchSize = DEFAULT_BATCH_SIZE,
  maxBatches = DEFAULT_MAX_BATCHES,
}: { now?: Date; batchSize?: number; maxBatches?: number } = {}): Promise<{
  deleted: number;
  batches: number;
}> {
  const cutoff = retentionCutoff(now);
  let deleted = 0;
  let batches = 0;

  while (batches < maxBatches) {
    // Batches are inherently sequential: each one shrinks the set the next sees.
    // eslint-disable-next-line no-await-in-loop
    const count = await dbClient.$executeRaw(Prisma.sql`
      DELETE FROM "AdminActivity"
      WHERE "id" IN (
        SELECT "id" FROM "AdminActivity"
        WHERE "createdAt" < ${cutoff}
        ORDER BY "createdAt"
        LIMIT ${batchSize}
      )`);
    batches += 1;
    deleted += count;
    if (count < batchSize) break;
  }

  return { deleted, batches };
}
