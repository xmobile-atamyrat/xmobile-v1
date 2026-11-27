import { Prisma } from '@prisma/client';

import dbClient from '@/lib/dbClient';

import { RAW_RETENTION_DAYS } from './constants';
import { sqlTimestamp } from './time';

const DEFAULT_BATCH_SIZE = 5000;
// One run removes at most 1M rows (~a month of raw events at 30k/day). A
// bigger backlog takes a few nights rather than holding the 4 GB VM's
// database busy in one go.
const DEFAULT_MAX_BATCHES = 200;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Raw events that occurred before this instant are deleted. */
export function analyticsRetentionCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - RAW_RETENTION_DAYS * MS_PER_DAY);
}

/**
 * Deletes raw `AnalyticsEvent` rows older than RAW_RETENTION_DAYS in batches.
 * Their daily rollups stay in `AnalyticsDaily`. Postgres has no
 * `DELETE … LIMIT`, so each batch picks its ids from the `occurredAt` index.
 */
export async function pruneAnalyticsEvents({
  now = new Date(),
  batchSize = DEFAULT_BATCH_SIZE,
  maxBatches = DEFAULT_MAX_BATCHES,
}: { now?: Date; batchSize?: number; maxBatches?: number } = {}): Promise<{
  deleted: number;
  batches: number;
}> {
  const cutoff = sqlTimestamp(analyticsRetentionCutoff(now));
  let deleted = 0;
  let batches = 0;

  while (batches < maxBatches) {
    // Batches are inherently sequential: each one shrinks the set the next sees.
    // eslint-disable-next-line no-await-in-loop
    const count = await dbClient.$executeRaw(Prisma.sql`
      DELETE FROM "AnalyticsEvent"
      WHERE "id" IN (
        SELECT "id" FROM "AnalyticsEvent"
        WHERE "occurredAt" < ${cutoff}
        ORDER BY "occurredAt"
        LIMIT ${batchSize}
      )`);
    batches += 1;
    deleted += count;
    if (count < batchSize) break;
  }

  return { deleted, batches };
}
