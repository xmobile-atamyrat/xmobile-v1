/**
 * Releases prices a product owns (`Prices.productId`) without referencing them
 * in its `price` or `tags`.
 *
 * Before ownership followed a product's references on save, picking a price in
 * the product form linked it on the spot, and removing the tag again — or
 * cancelling the dialog — never unlinked it. The wrongly picked price stayed
 * "taken" by that product, and no other product could select it.
 *
 * Each release is guarded on the price still having the owner this run saw, so
 * a concurrent admin edit is never overwritten. The out-of-stock state of every
 * product that loses a price is then re-derived from what it still owns, the
 * same rule src/lib/outOfStock.ts applies.
 *
 * Prices held by a soft-deleted product are reported but kept unless
 * `--include-deleted` is passed. They block other products the same way, but
 * releasing them is a separate decision from cleaning up a stray pick.
 *
 * The reverse drift — a price a product references but nobody owns — is only
 * counted here; `yarn backfill:product-prices-*` is what links those.
 *
 *   yarn cleanup:stale-price-links-dev                     # preview, writes nothing
 *   yarn cleanup:stale-price-links-dev --apply             # commit
 *   yarn cleanup:stale-price-links-prod --apply            # against .env
 *   ... --include-deleted                                  # also free soft-deleted products' prices
 */
import { PrismaClient } from '@prisma/client';

export interface ProductRef {
  id: string;
  price: string | null;
  tags: string[];
  deletedAt: Date | null;
  outOfStockAt: Date | null;
}

export interface PriceRef {
  id: string;
  productId: string | null;
  outOfStockAt: Date | null;
}

export interface StaleLink {
  priceId: string;
  productId: string;
}

export interface StaleLinkPlan {
  /** Owned by an active product that does not reference it. */
  stale: StaleLink[];
  /** Owned by a soft-deleted product. */
  deletedOwner: StaleLink[];
  /** Owner id with no product row at all; the FK makes this unexpected. */
  missingOwner: StaleLink[];
  /** Referenced by an active product, but owned by nobody. */
  unlinkedReferenced: number;
}

// Duplicated from src/lib/productPriceLinks.ts rather than imported, for the
// same reason scripts/backfill-product-prices.ts duplicates the regex: this
// runs under plain ts-node, without tsconfig-paths to resolve `@/`.
const squareBracketRegex = /\[([^\]]+)\]/;

// The base price is "[priceId]" from the product form, or the bare id on older
// rows. Dropping the bare form would release prices those rows really use.
export function referencedPriceIds(
  price: string | null,
  tags: string[],
): Set<string> {
  const ids = new Set<string>();
  const baseId = price?.match(squareBracketRegex)?.[1] ?? (price || undefined);
  if (baseId) ids.add(baseId);
  tags.forEach((tag) => {
    const priceId = tag.match(squareBracketRegex)?.[1];
    if (priceId) ids.add(priceId);
  });
  return ids;
}

export function planStaleLinks(
  products: ProductRef[],
  prices: PriceRef[],
): StaleLinkPlan {
  const productsById = new Map(products.map((p) => [p.id, p]));
  const refsByProduct = new Map(
    products.map((p) => [p.id, referencedPriceIds(p.price, p.tags)]),
  );
  const referencedByActive = new Set(
    products
      .filter((p) => p.deletedAt == null)
      .flatMap((p) => [...refsByProduct.get(p.id)!]),
  );

  const plan: StaleLinkPlan = {
    stale: [],
    deletedOwner: [],
    missingOwner: [],
    unlinkedReferenced: 0,
  };
  prices.forEach(({ id, productId }) => {
    if (productId == null) {
      if (referencedByActive.has(id)) plan.unlinkedReferenced += 1;
      return;
    }
    const owner = productsById.get(productId);
    const link = { priceId: id, productId };
    if (owner == null) {
      plan.missingOwner.push(link);
    } else if (owner.deletedAt != null) {
      plan.deletedOwner.push(link);
    } else if (!refsByProduct.get(productId)!.has(id)) {
      plan.stale.push(link);
    }
  });
  return plan;
}

/**
 * Which of `productIds` change stock state once `prices` reflects the
 * releases. Mirrors deriveProductOutOfStock: a product is out of stock exactly
 * when every price it owns is, and one that owns nothing is left as it is.
 */
export function planStockResync(
  products: ProductRef[],
  prices: PriceRef[],
  productIds: string[],
): { toOutOfStock: string[]; toInStock: string[] } {
  const productsById = new Map(products.map((p) => [p.id, p]));
  const result = { toOutOfStock: [] as string[], toInStock: [] as string[] };
  new Set(productIds).forEach((productId) => {
    const product = productsById.get(productId);
    if (product == null || product.deletedAt != null) return;
    const owned = prices.filter((price) => price.productId === productId);
    if (owned.length === 0) return;
    const soldOut = owned.every((price) => price.outOfStockAt != null);
    if (soldOut && product.outOfStockAt == null) {
      result.toOutOfStock.push(productId);
    } else if (!soldOut && product.outOfStockAt != null) {
      result.toInStock.push(productId);
    }
  });
  return result;
}

// Product/price names are stored as localized JSON blobs; fall back to the raw
// value when they are plain strings.
const bareName = (name: string): string => {
  try {
    const parsed = JSON.parse(name);
    return (
      parsed.en || parsed.tk || parsed.ru || parsed.ch || parsed.tr || name
    );
  } catch {
    return name;
  }
};

async function main() {
  const apply = process.argv.includes('--apply');
  const includeDeleted = process.argv.includes('--include-deleted');
  const dbClient = new PrismaClient();

  try {
    console.log(
      '--- Cleanup: prices owned by products that no longer use them ---\n',
    );

    const [products, prices] = await Promise.all([
      dbClient.product.findMany({
        select: {
          id: true,
          name: true,
          price: true,
          tags: true,
          deletedAt: true,
          outOfStockAt: true,
        },
      }),
      dbClient.prices.findMany({
        select: { id: true, name: true, productId: true, outOfStockAt: true },
      }),
    ]);

    const productNames = new Map(products.map((p) => [p.id, bareName(p.name)]));
    const priceNames = new Map(prices.map((p) => [p.id, bareName(p.name)]));
    const describe = ({ priceId, productId }: StaleLink) =>
      `${priceId}  "${priceNames.get(priceId)}"  held by  ${
        productNames.get(productId) ?? `<unknown ${productId}>`
      }`;

    const plan = planStaleLinks(products, prices);
    const toRelease = includeDeleted
      ? [...plan.stale, ...plan.deletedOwner]
      : plan.stale;

    console.log(
      `  ${prices.length} prices | ${prices.filter((p) => p.productId != null).length} owned | ${products.length} products\n`,
    );
    console.log(`  ->  ${plan.stale.length} stale links on active products`);
    console.log(
      `      ${plan.deletedOwner.length} held by soft-deleted products (${includeDeleted ? 'released' : 'kept; --include-deleted to release'})`,
    );
    console.log(
      `      ${plan.missingOwner.length} owner ids with no product row`,
    );
    console.log(
      `      ${plan.unlinkedReferenced} referenced but unowned (yarn backfill:product-prices-* links these)`,
    );

    if (plan.stale.length > 0) {
      console.log('\n  Stale links to release:');
      plan.stale.forEach((link) => console.log(`    ${describe(link)}`));
    }
    if (plan.deletedOwner.length > 0) {
      console.log(
        `\n  Held by soft-deleted products${includeDeleted ? ', to release' : ''}:`,
      );
      plan.deletedOwner.forEach((link) => console.log(`    ${describe(link)}`));
    }
    if (plan.missingOwner.length > 0) {
      console.log('\n  ⚠️  Owner ids with no product row (left alone):');
      plan.missingOwner.forEach((link) => console.log(`    ${describe(link)}`));
    }

    // Projected against the releases this run is about to make, so the dry run
    // shows the stock flips the --apply run would actually cause.
    const releasing = new Set(toRelease.map(({ priceId }) => priceId));
    const projected = prices.map((price) =>
      releasing.has(price.id) ? { ...price, productId: null } : price,
    );
    const stockPlan = planStockResync(
      products,
      projected,
      toRelease.map(({ productId }) => productId),
    );
    console.log(
      `\n  Stock state re-derived: ${stockPlan.toOutOfStock.length} to out of stock, ${stockPlan.toInStock.length} back in stock`,
    );
    [...stockPlan.toOutOfStock, ...stockPlan.toInStock].forEach((productId) =>
      console.log(
        `    ${stockPlan.toOutOfStock.includes(productId) ? 'OUT' : 'IN '}  ${productNames.get(productId)}`,
      ),
    );

    if (!apply) {
      console.log(
        '\n  DRY RUN — nothing written. Re-run with --apply to commit.',
      );
      return;
    }

    if (toRelease.length === 0) {
      console.log('\n  ✅ Nothing to release.');
      return;
    }

    const byOwner = new Map<string, string[]>();
    toRelease.forEach(({ priceId, productId }) => {
      byOwner.set(productId, [...(byOwner.get(productId) ?? []), priceId]);
    });
    const results = await dbClient.$transaction(
      [...byOwner.entries()].map(([productId, ids]) =>
        dbClient.prices.updateMany({
          where: { id: { in: ids }, productId },
          data: { productId: null },
        }),
      ),
    );
    const released = results.reduce((sum, r) => sum + r.count, 0);
    console.log(`\n  ✅ Released ${released} price links.`);
    if (released !== toRelease.length) {
      console.log(
        `  ⚠️  Expected ${toRelease.length}; ${toRelease.length - released} changed owner mid-run. Re-run to see the current state.`,
      );
    }

    // Re-read rather than trusting the projection, in case the guard above
    // skipped a row.
    const [freshProducts, freshPrices] = await Promise.all([
      dbClient.product.findMany({
        where: { id: { in: [...byOwner.keys()] } },
        select: {
          id: true,
          price: true,
          tags: true,
          deletedAt: true,
          outOfStockAt: true,
        },
      }),
      dbClient.prices.findMany({
        where: { productId: { in: [...byOwner.keys()] } },
        select: { id: true, productId: true, outOfStockAt: true },
      }),
    ]);
    const resync = planStockResync(freshProducts, freshPrices, [
      ...byOwner.keys(),
    ]);
    // Transition-guarded like src/lib/outOfStock.ts, so `outOfStockAt` — the
    // retention job's deadline — is only stamped on a real change.
    const [out, back] = await dbClient.$transaction([
      dbClient.product.updateMany({
        where: { id: { in: resync.toOutOfStock }, outOfStockAt: null },
        data: { outOfStockAt: new Date() },
      }),
      dbClient.product.updateMany({
        where: { id: { in: resync.toInStock }, outOfStockAt: { not: null } },
        data: { outOfStockAt: null },
      }),
    ]);
    console.log(
      `  ✅ Stock re-derived: ${out.count} out of stock, ${back.count} back in stock.`,
    );
    console.log(
      '  ℹ️  Cached product pages refresh on their ISR timer, or on the next edit.',
    );
  } catch (error) {
    console.error('\n  ❌ Cleanup failed:', error);
    process.exitCode = 1;
  } finally {
    await dbClient.$disconnect();
  }
}

// Guarded so tests can import the planners without opening a DB connection.
if (typeof require !== 'undefined' && require.main === module) {
  main();
}
