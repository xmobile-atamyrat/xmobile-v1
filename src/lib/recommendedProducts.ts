import { whereActiveProduct } from '@/lib/prismaActiveScope';
import { RECOMMENDED_PRODUCTS_MAX } from '@/pages/lib/constants';
import { Prisma } from '@prisma/client';

/** Thrown inside a transaction to roll back a save that would overfill the list. */
export class RecommendedListFullError extends Error {}

/** 1-based positions, the way the recommended admin screen numbers them. */
export type RecommendedChange = { from: number | null; to: number | null };

const activeRecommended: Prisma.ProductWhereInput = {
  ...whereActiveProduct,
  recommendedOrder: { not: null },
};

/**
 * Serialises every writer of the recommended list. Take it before any product
 * row lock in the transaction: the list endpoint locks in that order, and
 * taking them the other way round can deadlock against it.
 */
export async function lockRecommendedList(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('product:recommended'))`;
}

/** Cheap pre-check, outside any lock, for failing before side effects. */
export async function recommendedListIsFull(
  db: Prisma.TransactionClient,
): Promise<boolean> {
  return (
    (await db.product.count({ where: activeRecommended })) >=
    RECOMMENDED_PRODUCTS_MAX
  );
}

/**
 * Adds the product to the end of the recommended list or takes it off.
 * Returns the position change, or null when it was already in that state.
 * The caller must hold lockRecommendedList.
 */
export async function setProductRecommended(
  tx: Prisma.TransactionClient,
  productId: string,
  recommended: boolean,
): Promise<RecommendedChange | null> {
  const current = await tx.product.findUniqueOrThrow({
    where: { id: productId },
    select: { recommendedOrder: true, createdAt: true },
  });
  const { recommendedOrder } = current;
  if ((recommendedOrder != null) === recommended) return null;

  if (recommendedOrder != null) {
    // Same tie-break the list is read with (order asc, then newest first).
    const ahead = await tx.product.count({
      where: {
        ...activeRecommended,
        OR: [
          { recommendedOrder: { lt: recommendedOrder } },
          { recommendedOrder, createdAt: { gt: current.createdAt } },
        ],
      },
    });
    await tx.product.update({
      where: { id: productId },
      data: { recommendedOrder: null },
    });
    return { from: ahead + 1, to: null };
  }

  const listed = await tx.product.count({ where: activeRecommended });
  if (listed >= RECOMMENDED_PRODUCTS_MAX) {
    throw new RecommendedListFullError();
  }
  const { _max } = await tx.product.aggregate({
    where: activeRecommended,
    _max: { recommendedOrder: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: { recommendedOrder: (_max.recommendedOrder ?? -1) + 1 },
  });
  return { from: null, to: listed + 1 };
}
