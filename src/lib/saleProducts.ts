import dbClient from '@/lib/dbClient';
import { productIdsWithPriceInTags } from '@/lib/outOfStock';
import {
  productIdsReferencingPrices,
  productRevalidationPaths,
} from '@/lib/revalidateTargets';
import { squareBracketRegex } from '@/pages/lib/constants';
import { regularPriceOf, salePercentOf } from '@/pages/lib/priceDisplay';
import { ProductSale } from '@/pages/lib/types';
import { Prices, Prisma } from '@prisma/client';

/**
 * Which products are on sale. Nothing is stored on the product: it is worked
 * out from the price rows at query time, so no write path can leave it stale.
 *
 * A product is on sale when it is in stock and any price it references, the base
 * `price` or a variant tag "[priceId]", is in stock with an active sale. What
 * counts as active is decided by salePercentOf alone; the queries here only
 * narrow the candidates.
 *
 * Server only.
 */

type SalePriceRow = Pick<
  Prices,
  'id' | 'priceInTmt' | 'displayPriceTmt' | 'salePriceTmt'
>;

export interface OnSaleProduct {
  id: string;
  /** The biggest discount among the product's in-stock prices. */
  bestPercent: number;
}

/**
 * Every active, in-stock product on sale: biggest discount first, then newest.
 * One query.
 */
export async function getOnSaleProducts(): Promise<OnSaleProduct[]> {
  // The first branch is the base price, "[id]" or the legacy bare id; the
  // second the variant tags, which only count when they carry a "[id]".
  const rows = await dbClient.$queryRaw<
    (SalePriceRow & { productId: string; createdAt: Date })[]
  >(Prisma.sql`
    SELECT p."id" AS "productId", p."createdAt", pr."id",
      pr."priceInTmt", pr."displayPriceTmt", pr."salePriceTmt"
    FROM "Product" p
    CROSS JOIN LATERAL (
      SELECT COALESCE(substring(p."price" from '\\[([^]]+)\\]'), p."price") AS id
      UNION
      SELECT substring(tag from '\\[([^]]+)\\]') FROM unnest(p."tags") AS tag
    ) AS ref
    JOIN "Prices" pr ON pr."id" = ref.id
    WHERE p."deletedAt" IS NULL
      AND p."outOfStockAt" IS NULL
      AND pr."salePriceTmt" IS NOT NULL
      AND pr."outOfStockAt" IS NULL`);

  const best = new Map<string, { bestPercent: number; createdAt: Date }>();
  rows.forEach((row) => {
    const percent = salePercentOf(row);
    if (percent == null) return;
    const known = best.get(row.productId);
    if (known == null || percent > known.bestPercent) {
      best.set(row.productId, {
        bestPercent: percent,
        createdAt: row.createdAt,
      });
    }
  });

  return [...best]
    .sort(
      ([idA, a], [idB, b]) =>
        b.bestPercent - a.bestPercent ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        // Ties must keep one order, or pages would repeat or skip products.
        idA.localeCompare(idB),
    )
    .map(([id, { bestPercent }]) => ({ id, bestPercent }));
}

interface SaleCandidate {
  price: string | null;
  tags: string[];
  outOfStockAt: Date | null;
}

// Reads both the stored "[id]" and the served "[id]{value}", and the legacy
// bare id in either shape.
const basePriceIdOf = (price: string | null): string | null =>
  price?.match(squareBracketRegex)?.[1] ?? (price?.split('{')[0] || null);

const priceIdsOf = ({ price, tags }: SaleCandidate): string[] =>
  [
    basePriceIdOf(price),
    ...tags.map((tag) => tag.match(squareBracketRegex)?.[1]),
  ].filter((id): id is string => id != null);

function saleOf(
  product: SaleCandidate,
  rowsById: Map<string, SalePriceRow>,
): ProductSale | null {
  if (product.outOfStockAt != null) return null;

  const percents = priceIdsOf(product).flatMap((id) => {
    const row = rowsById.get(id);
    const percent = row ? salePercentOf(row) : null;
    return percent == null ? [] : [percent];
  });
  if (percents.length === 0) return null;

  const baseRow = rowsById.get(basePriceIdOf(product.price) ?? '');
  const basePercent = baseRow ? salePercentOf(baseRow) : null;

  return {
    bestPercent: Math.max(...percents),
    base:
      baseRow != null && basePercent != null
        ? { oldPrice: regularPriceOf(baseRow), percent: basePercent }
        : null,
  };
}

/**
 * Copies of the products with `sale` filled in, using one price query for the
 * whole list. `price` and `tags` are passed through untouched.
 */
export async function withSale<T extends SaleCandidate>(
  products: T[],
): Promise<(T & { sale: ProductSale | null })[]> {
  const ids = [
    ...new Set(
      products
        .filter((product) => product.outOfStockAt == null)
        .flatMap(priceIdsOf),
    ),
  ];
  const rows =
    ids.length > 0
      ? await dbClient.prices.findMany({
          where: {
            id: { in: ids },
            salePriceTmt: { not: null },
            outOfStockAt: null,
          },
          select: {
            id: true,
            priceInTmt: true,
            displayPriceTmt: true,
            salePriceTmt: true,
          },
        })
      : [];
  const rowsById = new Map(rows.map((row) => [row.id, row]));

  return products.map((product) => ({
    ...product,
    sale: saleOf(product, rowsById),
  }));
}

/**
 * Cached pages of every product carrying a price with a stored sale. A rate
 * change moves normal prices, which can start or stop a sale, so these are the
 * pages whose sale styling may have gone stale.
 */
export async function saleRevalidationPaths(): Promise<string[]> {
  const rows = await dbClient.prices.findMany({
    where: { salePriceTmt: { not: null } },
    select: { id: true },
  });
  const ids = rows.map((row) => row.id);

  return productRevalidationPaths([
    ...(await productIdsReferencingPrices(ids)),
    ...(await productIdsWithPriceInTags(ids)),
  ]);
}
