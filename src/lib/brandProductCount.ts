import dbClient from '@/lib/dbClient';

/** Recompute `Brand.productCount` from non–soft-deleted products only. */
export async function syncBrandProductCount(
  brandId: string | null | undefined,
) {
  if (!brandId) return;

  const count = await dbClient.product.count({
    where: { brandId, deletedAt: null },
  });

  await dbClient.brand.update({
    where: { id: brandId },
    data: { productCount: count },
  });
}
