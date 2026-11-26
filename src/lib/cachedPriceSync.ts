import dbClient from '@/lib/dbClient';
import { cachedPriceFrom } from '@/pages/lib/priceDisplay';
import { Prisma } from '@prisma/client';

/**
 * Refreshes the denormalized cachedPrice on every product whose base price
 * points at one of the matching Prices rows (raw id or [id] format), in a
 * single pass over the table instead of one non-indexable LIKE scan per price.
 * The rows are re-read here because a row's stored sale price and stock state
 * both decide what is shown.
 *
 * Server only.
 */
export async function syncCachedPrices(where: Prisma.PricesWhereInput) {
  const rows = await dbClient.prices.findMany({
    where,
    select: {
      id: true,
      priceInTmt: true,
      displayPriceTmt: true,
      salePriceTmt: true,
      outOfStockAt: true,
    },
  });
  const shown = rows.flatMap((row) => {
    const value = cachedPriceFrom(row);
    return value == null ? [] : [{ id: row.id, value }];
  });
  if (shown.length === 0) return;

  const values = Prisma.join(
    shown.map(
      ({ id, value }) => Prisma.sql`(${id}::text, ${value}::double precision)`,
    ),
  );
  // pid is a uuid (no % or _), so it needs no LIKE escaping; [ ] are literal in
  // Postgres LIKE, matching the "[id]" base-price format.
  await dbClient.$executeRaw`
    UPDATE "Product" AS p
    SET "cachedPrice" = v.shown
    FROM (VALUES ${values}) AS v(pid, shown)
    WHERE p."deletedAt" IS NULL
      AND (p."price" = v.pid OR p."price" LIKE '%[' || v.pid || ']%')
  `;
}
