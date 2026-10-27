import { Prisma } from '@prisma/client';

/**
 * Postgres treats NULL brandIds as distinct, so the (brandId, name) and
 * (brandId, hex) unique indexes don't stop two unbranded colors from sharing a
 * name or hex. Every write that can leave a color unbranded takes this lock
 * and checks first, so concurrent requests can't both pass the check.
 * Released when the transaction ends.
 */
export async function lockUnbrandedColors(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('color:unbranded'))`;
}

export async function hasUnbrandedClash(
  tx: Prisma.TransactionClient,
  colors: { name: string; hex: string }[],
  excludeIds: string[] = [],
): Promise<boolean> {
  if (colors.length === 0) return false;
  const count = await tx.color.count({
    where: {
      brandId: null,
      id: { notIn: excludeIds },
      OR: [
        { name: { in: colors.map((color) => color.name) } },
        { hex: { in: colors.map((color) => color.hex) } },
      ],
    },
  });
  return count > 0;
}
