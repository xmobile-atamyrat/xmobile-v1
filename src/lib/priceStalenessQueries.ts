// Database side of the stale-price warnings. The rules themselves live in
// ./priceStaleness, which stays free of server imports so pages can use it.
import { referencedPriceIds } from '@/lib/outOfStock';
import { productStaleness, type ProductStaleness } from '@/lib/priceStaleness';
import { whereActiveProduct } from '@/lib/prismaActiveScope';
import type { PrismaClient } from '@prisma/client';

type ProductPriceRefs = { id: string; price: string | null; tags: string[] };

async function loadCheckedAt(
  db: PrismaClient,
  ids: string[],
): Promise<Map<string, Date>> {
  if (ids.length === 0) return new Map();
  const rows = await db.prices.findMany({
    where: { id: { in: ids } },
    select: { id: true, priceCheckedAt: true },
  });
  return new Map(rows.map((r) => [r.id, r.priceCheckedAt]));
}

export async function getProductStalenessMap(
  db: PrismaClient,
  products: ProductPriceRefs[],
  now: Date = new Date(),
): Promise<Map<string, ProductStaleness>> {
  const idsByProduct = new Map<string, string[]>();
  const allIds = new Set<string>();
  products.forEach((p) => {
    const ids = referencedPriceIds(p.price, p.tags);
    idsByProduct.set(p.id, ids);
    ids.forEach((id) => allIds.add(id));
  });
  const checkedAtById = await loadCheckedAt(db, [...allIds]);
  const result = new Map<string, ProductStaleness>();
  products.forEach((p) => {
    result.set(
      p.id,
      productStaleness(idsByProduct.get(p.id) ?? [], checkedAtById, now),
    );
  });
  return result;
}

export async function countStaleProducts(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<{ orange: number; red: number }> {
  const products = await db.product.findMany({
    where: { ...whereActiveProduct, outOfStockAt: null },
    select: { id: true, price: true, tags: true },
  });
  const map = await getProductStalenessMap(db, products, now);
  const counts = { orange: 0, red: 0 };
  map.forEach(({ tier }) => {
    if (tier === 'red') counts.red += 1;
    else if (tier === 'orange') counts.orange += 1;
  });
  return counts;
}
