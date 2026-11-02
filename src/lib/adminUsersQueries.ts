import dbClient from '@/lib/dbClient';
import { ROLE_FILTERS, RoleFilter } from '@/pages/lib/adminUsers';
import { Prisma, UserRole } from '@prisma/client';
import { z } from 'zod';

const PAGE_SIZE = 30;

export const userListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(ROLE_FILTERS).default('STAFF'),
  cursor: z.string().min(1).optional(),
});

export const roleChangeSchema = z.object({
  userId: z.string().min(1),
  grade: z.nativeEnum(UserRole),
});

const gradeWhere = (role: RoleFilter): Prisma.UserWhereInput => {
  if (role === 'ALL') return {};
  if (role === 'STAFF') {
    return { grade: { in: [UserRole.ADMIN, UserRole.SUPERUSER] } };
  }
  return { grade: role };
};

/**
 * One page of live accounts, superusers first, then admins, then customers
 * (the enum's declared order, reversed), each group by name.
 */
export async function listUsers(params: z.infer<typeof userListQuerySchema>) {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...gradeWhere(params.role),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: 'insensitive' } },
            { email: { contains: params.q, mode: 'insensitive' } },
            { phoneNumber: { contains: params.q } },
          ],
        }
      : {}),
  };

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
    orderBy: [{ grade: 'desc' }, { name: 'asc' }, { id: 'asc' }],
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
