import dbClient from '@/lib/dbClient';
import { AuthenticatedConnection } from '@/ws-server/lib/types';
import { UserRole } from '@prisma/client';

/** Only ADMIN grade is tracked; superusers are not shown on the staff cards. */
export const isTrackedAdmin = (connection: AuthenticatedConnection): boolean =>
  connection.userGrade === UserRole.ADMIN;

/**
 * The connection registry lives in this process's memory, so the Next.js API
 * cannot see it. `User.lastSeenAt` is how presence crosses that boundary: the
 * admin activity page treats an admin as online when it is recent.
 */
export function adminUserIdsOnline(
  connectionsMap: Map<string, Set<AuthenticatedConnection>>,
): string[] {
  return [...connectionsMap.entries()]
    .filter(([, sockets]) => [...sockets].some(isTrackedAdmin))
    .map(([userId]) => userId);
}

/**
 * One batched write for any number of admins. The grade is re-checked in the
 * query rather than trusted from the socket, so a demoted user whose connection
 * is still open is not stamped. Never throws: presence is best-effort and must
 * not disturb chat.
 */
export async function touchAdminLastSeen(
  userIds: string[],
  now: Date = new Date(),
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    await dbClient.user.updateMany({
      where: { id: { in: userIds }, grade: UserRole.ADMIN },
      data: { lastSeenAt: now },
    });
  } catch (error) {
    console.warn('[adminPresence] failed to record last seen:', error);
  }
}
