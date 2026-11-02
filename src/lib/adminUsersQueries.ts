import dbClient from '@/lib/dbClient';
import { Prisma, UserRole } from '@prisma/client';
import { z } from 'zod';

const PAGE_SIZE = 30;

export const userListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  cursor: z.string().min(1).optional(),
});

export const roleChangeSchema = z.object({
  userId: z.string().min(1),
  grade: z.nativeEnum(UserRole),
});

/**
 * One page of live accounts. Without a search term, superusers come first,
 * then admins, then customers (the enum's declared order, reversed), each
 * group by name. With one, every account whose name, email or phone contains
 * it (case-insensitively) is listed by name.
 */
export async function listUsers(params: z.infer<typeof userListQuerySchema>) {
  const { q } = params;
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phoneNumber: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const byName: Prisma.UserOrderByWithRelationInput[] = [
    { name: 'asc' },
    { id: 'asc' },
  ];

  const rows = await dbClient.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      grade: true,
      createdAt: true,
    },
    orderBy: q ? byName : [{ grade: 'desc' }, ...byName],
    take: PAGE_SIZE + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

export type RoleChangeResult =
  | { ok: true; user: { id: string; grade: UserRole } }
  | { ok: false; status: 400 | 404; message: string };

/**
 * Sets another account's role. A superuser can never change their own role,
 * so there is always at least one superuser left: the one making the change.
 */
export async function changeUserRole(
  actorId: string,
  targetId: string,
  grade: UserRole,
): Promise<RoleChangeResult> {
  if (actorId === targetId) {
    return {
      ok: false,
      status: 400,
      message: "You can't change your own role",
    };
  }

  const target = await dbClient.user.findUnique({
    where: { id: targetId },
    select: { id: true, grade: true, deletedAt: true },
  });
  if (target == null || target.deletedAt != null) {
    return { ok: false, status: 404, message: 'User not found' };
  }
  if (target.grade !== grade) {
    await dbClient.user.update({ where: { id: targetId }, data: { grade } });
  }

  return { ok: true, user: { id: target.id, grade } };
}
