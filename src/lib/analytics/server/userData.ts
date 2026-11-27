import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Detaches analytics from accounts that are being deleted for good: their raw
 * events stay (aggregates don't change) but no longer name the user.
 * `AnalyticsEvent.userId` has no foreign key, so nothing else clears it.
 *
 * Returns the unawaited Prisma query, so it can go into the same
 * `$transaction([...])` as the delete.
 */
export function detachAnalyticsFromUsers(
  db: Prisma.TransactionClient | PrismaClient,
  userIds: string[],
): Prisma.PrismaPromise<Prisma.BatchPayload> {
  return db.analyticsEvent.updateMany({
    where: { userId: { in: userIds } },
    data: { userId: null },
  });
}
