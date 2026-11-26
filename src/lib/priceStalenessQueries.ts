// Database side of the stale-price warnings. The rules themselves live in
// ./priceStaleness, which stays free of server imports so pages can use it.
import { referencedPriceIds } from '@/lib/outOfStock';
import {
  productStaleness,
  type ProductStaleness,
  type StaleProduct,
} from '@/lib/priceStaleness';
import { whereActiveProduct } from '@/lib/prismaActiveScope';
import type { PrismaClient } from '@prisma/client';

type ProductPriceRefs = { id: string; price: string | null; tags: string[] };

async function loadCheckedAt(
  db: PrismaClient,
  ids: string[],
): Promise<Map<string, Date>> {
  if (ids.length === 0) return new Map();
  // Sold-out price rows are left out: nobody sells at that price, so its age
  // must not make an in-stock product look stale.
  const rows = await db.prices.findMany({
    where: { id: { in: ids }, outOfStockAt: null },
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

/**
 * Every in-stock active product with a stale tier, keyed by product id.
 * Fresh products are left out, so the result stays small enough to send to
 * an admin's browser in one response.
 */
export async function getStaleProducts(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<Record<string, StaleProduct>> {
  const products = await db.product.findMany({
    where: { ...whereActiveProduct, outOfStockAt: null },
    select: { id: true, price: true, tags: true },
  });
  const map = await getProductStalenessMap(db, products, now);
  const result: Record<string, StaleProduct> = {};
  map.forEach(({ tier, days }, id) => {
    if (tier != null && days != null) result[id] = { tier, days };
  });
  return result;
}

export async function countStaleProducts(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<{ orange: number; red: number }> {
  const counts = { orange: 0, red: 0 };
  Object.values(await getStaleProducts(db, now)).forEach(({ tier }) => {
    counts[tier] += 1;
  });
  return counts;
}
