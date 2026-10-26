import dbClient from '@/lib/dbClient';
import { AuthenticatedConnection } from '@/ws-server/lib/types';
import { UserRole } from '@prisma/client';

const STAFF_GRADES: UserRole[] = [UserRole.ADMIN, UserRole.SUPERUSER];

/**
 * The connection registry lives in this process's memory, so the Next.js API
 * cannot see it. `User.lastSeenAt` is how presence crosses that boundary: the
 * admin activity page treats an admin as online when it is recent.
 *
 * Takes the ws-server's `adminConnections` set, which already holds exactly the
 * staff sockets, so a sweep never walks the customers' connections.
 */
export function adminUserIdsOnline(
  adminSockets: Set<AuthenticatedConnection>,
): string[] {
  return [...new Set([...adminSockets].map((socket) => socket.userId))];
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
      where: { id: { in: userIds }, grade: { in: STAFF_GRADES } },
      data: { lastSeenAt: now },
    });
  } catch (error) {
    console.warn('[adminPresence] failed to record last seen:', error);
  }
}
