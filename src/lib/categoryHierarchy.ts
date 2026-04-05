import dbClient from '@/lib/dbClient';
import type { Prisma } from '@prisma/client';

/** Order for sibling categories (same `predecessorId`) everywhere we list children. */
export const categorySiblingOrderBy: Prisma.CategoryOrderByWithRelationInput[] =
  [{ sortOrder: 'asc' }, { createdAt: 'asc' }];

/** Active category ids in subtree (root + descendants), excluding already-deleted rows. */
export async function collectActiveSubtreeCategoryIds(
  rootId: string,
): Promise<string[]> {
  const root = await dbClient.category.findFirst({
    where: { id: rootId, deletedAt: null },
    include: {
      successorCategories: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
  });
  if (!root) return [];
  const nested = await Promise.all(
    root.successorCategories.map(({ id }) =>
      collectActiveSubtreeCategoryIds(id),
    ),
  );
  return [root.id, ...nested.flat()];
}

/** Next `sortOrder` when appending a new child under `predecessorId` (null = root). */
export async function nextSiblingSortOrder(
  predecessorId: string | null,
): Promise<number> {
  const last = await dbClient.category.findFirst({
    where: {
      predecessorId,
      deletedAt: null,
    },
    orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? -1) + 1;
}
