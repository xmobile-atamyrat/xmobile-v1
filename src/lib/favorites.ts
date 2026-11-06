import dbClient from '@/lib/dbClient';
import { whereActiveProduct } from '@/lib/prismaActiveScope';
import { Prisma } from '@prisma/client';

/**
 * A user's favorites that are still in the catalog. Soft-deleted products stay
 * linked, so they are filtered out here and come back if they are restored.
 */
export const whereActiveFavorite = (
  userId: string,
): Prisma.ProductWhereInput => ({
  ...whereActiveProduct,
  favoritedBy: { some: { id: userId } },
});

export async function activeFavoriteIds(userId: string): Promise<string[]> {
  const products = await dbClient.product.findMany({
    where: whereActiveFavorite(userId),
    select: { id: true },
  });
  return products.map(({ id }) => id);
}
