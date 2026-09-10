import { syncBrandProductCount } from '@/lib/brandProductCount';
import dbClient from '@/lib/dbClient';
import { whereActiveProduct } from '@/lib/prismaActiveScope';

/**
 * Out-of-stock state lives on both `Product` and `Prices`, as a nullable
 * `outOfStockAt`: a timestamp means sold out, null means available. The two are
 * kept consistent by one rule, applied in the two directions it can be
 * triggered from:
 *
 *   a product is out of stock exactly when every price it owns is out of stock
 *
 * - `setProductOutOfStock` — an admin flips the product; the state cascades
 *   down to all of its connected prices.
 * - `syncProductOutOfStockFromPrices` — a price's own state changed; the
 *   product's is re-derived from the prices it owns.
 *
 * Neither function calls the other, so a cascade cannot loop: the first writes
 * downward only, the second upward only.
 *
 * Products with no connected prices are left alone in the upward direction —
 * there is nothing to derive from, so an admin's manual state stands. Note the
 * corollary of the rule for products that *do* have prices: putting a single
 * price back in stock puts the product back in stock, even if the product was
 * marked out of stock by hand. Price state wins, because it is the more
 * specific fact.
 *
 * `outOfStockAt` is written only on a real transition. It is what the yearly
 * cleanup measures its cutoff against, so re-saving a row that is already out
 * of stock must not push that deadline out. Each transition is expressed as the
 * `where` clause of an `updateMany` rather than a read-then-write — matching on
 * `outOfStockAt: null` going out of stock, and on `{ not: null }` coming back —
 * which makes every call here idempotent and safe against a concurrent writer.
 */

/**
 * The rule itself, kept pure so it can be tested without a database.
 * Returns null when the product owns no prices and nothing can be derived.
 */
export function deriveProductOutOfStock(
  prices: { outOfStockAt: Date | null }[],
): boolean | null {
  if (prices.length === 0) return null;
  return prices.every((price) => price.outOfStockAt != null);
}

/**
 * Whether a product edit should cascade its stock state down onto its prices,
 * and with what value. Null means "leave the prices alone".
 *
 * The product form posts `isOutOfStock` on every save, so the field being
 * present cannot stand in for the admin having touched it. Only a real
 * difference from the stored row may cascade — otherwise renaming a product
 * would run `setProductOutOfStock(id, false)` and quietly put every
 * individually sold-out price back in stock, erasing the `outOfStockAt`
 * deadlines the retention job measures against.
 */
export function outOfStockCascade(
  requested: boolean | undefined,
  current: boolean,
): boolean | null {
  if (requested == null) return null;
  if (requested === current) return null;
  return requested;
}

/**
 * The stock column a freshly created product starts with.
 *
 * Kept here rather than inlined at the call site because it is the one place
 * that turns the form's boolean into the column: a product created out of stock
 * needs a real `outOfStockAt`, or the retention job — which ignores rows with
 * no timestamp — would never see it.
 */
export function initialOutOfStockFields(isOutOfStock: boolean): {
  outOfStockAt: Date | null;
} {
  return { outOfStockAt: isOutOfStock ? new Date() : null };
}

/**
 * Marks a product out of stock (or back in stock) and cascades to every price
 * it owns. The price cascade is not conditional on the product actually
 * changing: a price connected while the product was already out of stock still
 * needs to be brought in line.
 */
export async function setProductOutOfStock(
  productId: string,
  isOutOfStock: boolean,
): Promise<void> {
  if (isOutOfStock) {
    const now = new Date();
    await dbClient.$transaction([
      dbClient.product.updateMany({
        where: { id: productId, outOfStockAt: null },
        data: { outOfStockAt: now },
      }),
      dbClient.prices.updateMany({
        where: { productId, outOfStockAt: null },
        data: { outOfStockAt: now },
      }),
    ]);
    return;
  }

  await dbClient.$transaction([
    dbClient.product.updateMany({
      where: { id: productId, outOfStockAt: { not: null } },
      data: { outOfStockAt: null },
    }),
    dbClient.prices.updateMany({
      where: { productId, outOfStockAt: { not: null } },
      data: { outOfStockAt: null },
    }),
  ]);
}

/** Re-derives one product's state from the prices it owns. */
export async function syncProductOutOfStockFromPrices(
  productId: string,
): Promise<void> {
  const prices = await dbClient.prices.findMany({
    where: { productId },
    select: { outOfStockAt: true },
  });

  const derived = deriveProductOutOfStock(prices);
  if (derived == null) return;

  if (derived) {
    await dbClient.product.updateMany({
      where: { id: productId, outOfStockAt: null },
      data: { outOfStockAt: new Date() },
    });
    return;
  }

  await dbClient.product.updateMany({
    where: { id: productId, outOfStockAt: { not: null } },
    data: { outOfStockAt: null },
  });
}

export interface OutOfStockSyncResult {
  markedOutOfStock: number;
  markedInStock: number;
}

/**
 * The same upward rule applied to the whole catalog, for the daily batch.
 * Bulk-shaped rather than a loop over `syncProductOutOfStockFromPrices`: one
 * read of every active product's price state, then at most two writes.
 */
export async function syncAllProductsOutOfStock(): Promise<OutOfStockSyncResult> {
  const products = await dbClient.product.findMany({
    where: whereActiveProduct,
    select: {
      id: true,
      outOfStockAt: true,
      prices: { select: { outOfStockAt: true } },
    },
  });

  const toMarkOutOfStock: string[] = [];
  const toMarkInStock: string[] = [];

  products.forEach(({ id, outOfStockAt, prices }) => {
    const derived = deriveProductOutOfStock(prices);
    if (derived == null || derived === (outOfStockAt != null)) return;
    (derived ? toMarkOutOfStock : toMarkInStock).push(id);
  });

  const now = new Date();
  const writes = [];
  if (toMarkOutOfStock.length > 0) {
    writes.push(
      dbClient.product.updateMany({
        where: { id: { in: toMarkOutOfStock }, outOfStockAt: null },
        data: { outOfStockAt: now },
      }),
    );
  }
  if (toMarkInStock.length > 0) {
    writes.push(
      dbClient.product.updateMany({
        where: { id: { in: toMarkInStock }, outOfStockAt: { not: null } },
        data: { outOfStockAt: null },
      }),
    );
  }
  if (writes.length > 0) await dbClient.$transaction(writes);

  return {
    markedOutOfStock: toMarkOutOfStock.length,
    markedInStock: toMarkInStock.length,
  };
}

export interface OutOfStockCleanupResult {
  retired: number;
  skippedWithActiveBanner: number;
}

/**
 * Soft-deletes products that have been out of stock since before the cutoff.
 *
 * Soft, not hard: products carry `deletedAt` everywhere else in the codebase,
 * and orders reference them long after they stop being sold. This mirrors
 * DELETE /api/product exactly — same banner guard, same cart-item cleanup, same
 * brand recount — so a product retired by the batch is indistinguishable from
 * one an admin deleted by hand.
 *
 * The single `outOfStockAt: { lt: cutoff }` does both halves of the selection:
 * it picks the rows old enough to retire, and an in-stock product — whose
 * `outOfStockAt` is null — can never satisfy a range bound, so no separate
 * "and it is actually sold out" filter is needed.
 */
export async function retireLongOutOfStockProducts(
  retentionDays: number,
): Promise<OutOfStockCleanupResult> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const candidates = await dbClient.product.findMany({
    where: {
      deletedAt: null,
      outOfStockAt: { lt: cutoff },
    },
    select: { id: true, brandId: true },
  });

  if (candidates.length === 0) {
    return { retired: 0, skippedWithActiveBanner: 0 };
  }

  // A live banner pointing at the product would be left redirecting into a
  // deleted page, so those are skipped and reported rather than retired.
  const banners = await dbClient.promoBanner.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      redirectProductId: { in: candidates.map(({ id }) => id) },
    },
    select: { redirectProductId: true },
  });
  const blocked = new Set(
    banners
      .map(({ redirectProductId }) => redirectProductId)
      .filter((id): id is string => id != null),
  );

  const toRetire = candidates.filter(({ id }) => !blocked.has(id));
  if (toRetire.length === 0) {
    return { retired: 0, skippedWithActiveBanner: blocked.size };
  }

  const ids = toRetire.map(({ id }) => id);
  await dbClient.$transaction([
    dbClient.product.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
    dbClient.cartItem.deleteMany({ where: { productId: { in: ids } } }),
    // The prices are released rather than left pointing at a row no admin
    // screen lists any more. A price still owned by a retired product is a
    // dead end: it no longer counts as unassigned, so nothing offers it, and
    // the reassignment guard refuses to hand it to another product because it
    // looks taken.
    dbClient.prices.updateMany({
      where: { productId: { in: ids } },
      data: { productId: null },
    }),
  ]);

  const brandIds = new Set(
    toRetire
      .map(({ brandId }) => brandId)
      .filter((brandId): brandId is string => brandId != null),
  );
  await Promise.all(
    [...brandIds].map((brandId) => syncBrandProductCount(brandId)),
  );

  return { retired: ids.length, skippedWithActiveBanner: blocked.size };
}
