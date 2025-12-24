import dbClient from '@/lib/dbClient';

/**
 * Checks if a user is an admin or superuser
 */
export async function checkAdmin(userId: string): Promise<boolean> {
  const user = await dbClient.user.findUnique({ where: { id: userId } });
  return user != null && ['ADMIN', 'SUPERUSER'].includes(user.grade);
}
