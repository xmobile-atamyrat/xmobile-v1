/**
 * Backfills `Prices.productId` from the products that reference each price.
 *
 * Before the 20260830124234_add_product_price_relation migration, the only link
 * between a product and its prices lived inside strings: `Product.price`
 * ("[priceId]") and each entry of `Product.tags` ("128gb 12gb ram
 * [priceId]{colorId}"). This persists that derivation into the new column.
 *
 * A price belongs to at most one product, so only prices referenced by exactly
 * one product can be assigned. Prices referenced by several products are
 * reported and left NULL for manual review — never guessed at.
 *
 * Only fills rows where `productId IS NULL` — existing links are treated as
 * hand-curated and are never overwritten, which also makes re-runs a no-op.
 *
 *   yarn backfill:product-prices-dev            # preview, writes nothing
 *   yarn backfill:product-prices-dev --apply    # commit
 *   yarn backfill:product-prices-prod --apply   # against .env
 */
import { PrismaClient } from '@prisma/client';

export interface ProductRef {
  id: string;
  price: string | null;
  tags: string[];
}

export interface DerivedProducts {
  /** priceId -> the single product that references it. */
  resolved: Map<string, string>;
  /** priceId -> the competing productIds, when several products reference it. */
  ambiguous: Map<string, string[]>;
}

// Matches the bracket syntax the product form writes into `price` and `tags`.
// Duplicated rather than imported from
// @/pages/lib/constants because this script runs without tsconfig-paths, and
// the obvious alternative — parseVariantTag in src/pages/product/utils.ts —
// drags xlsx and papaparse into a database migration.
const squareBracketRegex = /\[([^\]]+)\]/;

export function deriveProductPrices(products: ProductRef[]): DerivedProducts {
  const sets = new Map<string, Set<string>>();

  const add = (raw: string | null, productId: string) => {
    const priceId = raw?.match(squareBracketRegex)?.[1];
    if (priceId == null) return;
    const owners = sets.get(priceId) ?? new Set<string>();
    owners.add(productId);
    sets.set(priceId, owners);
  };

  products.forEach(({ id, price, tags }) => {
    add(price, id);
    tags.forEach((tag) => add(tag, id));
  });

  const resolved = new Map<string, string>();
  const ambiguous = new Map<string, string[]>();

  sets.forEach((owners, priceId) => {
    if (owners.size === 1) {
      resolved.set(priceId, [...owners][0]);
    } else {
      ambiguous.set(priceId, [...owners]);
    }
  });

  return { resolved, ambiguous };
}

export interface ProductStockRef {
  id: string;
  outOfStockAt: Date | null;
}

export interface PriceStockRef {
  id: string;
  productId: string | null;
  outOfStockAt: Date | null;
}

/**
 * Picks the prices that have to inherit their product's out-of-stock state.
 *
 * Before this migration, "out of stock" only existed on the product. The new
 * `Prices.outOfStockAt` column starts null, so without this step every sold-out
 * product is owned by prices that all claim to be in stock — and the first run
 * of the upward sync (or the first price edit) would derive the product back
 * into stock and lose which products were sold out.
 *
 * Runs after the linking phase, since it can only see prices that already have
 * a `productId`. Prices already out of stock are skipped so a re-run writes
 * nothing and never re-stamps `outOfStockAt`.
 */
export function planPriceStockBackfill(
  products: ProductStockRef[],
  prices: PriceStockRef[],
): string[] {
  const soldOut = new Set(
    products
      .filter(({ outOfStockAt }) => outOfStockAt != null)
      .map(({ id }) => id),
  );

  return prices
    .filter(
      ({ productId, outOfStockAt }) =>
        productId != null && outOfStockAt == null && soldOut.has(productId),
    )
    .map(({ id }) => id);
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
  const dbClient = new PrismaClient();

  try {
    console.log('--- Backfill: Prices.productId from product references ---\n');

    const [products, prices] = await Promise.all([
      dbClient.product.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          price: true,
          tags: true,
          outOfStockAt: true,
        },
      }),
      dbClient.prices.findMany({
        select: {
          id: true,
          name: true,
          productId: true,
          outOfStockAt: true,
        },
      }),
    ]);

    const productNames = new Map(products.map((p) => [p.id, bareName(p.name)]));
    const nameOf = (id: string) => productNames.get(id) ?? `<unknown ${id}>`;

    const { resolved, ambiguous } = deriveProductPrices(products);

    const toLink: { id: string; name: string; productId: string }[] = [];
    const ambiguousRows: { id: string; name: string; productIds: string[] }[] =
      [];
    let alreadyLinked = 0;
    let unreferenced = 0;

    prices.forEach(({ id, name, productId }) => {
      if (productId != null) {
        alreadyLinked += 1;
      } else if (ambiguous.has(id)) {
        ambiguousRows.push({ id, name, productIds: ambiguous.get(id)! });
      } else if (resolved.has(id)) {
        toLink.push({ id, name, productId: resolved.get(id)! });
      } else {
        unreferenced += 1;
      }
    });

    const knownPriceIds = new Set(prices.map((p) => p.id));
    const orphanRefs = [...resolved.keys(), ...ambiguous.keys()].filter(
      (priceId) => !knownPriceIds.has(priceId),
    );

    console.log(
      `  ${prices.length} prices | ${resolved.size + ambiguous.size} referenced by ${products.length} active products\n`,
    );
    console.log(`  ->  ${toLink.length} to link`);
    console.log(`      ${alreadyLinked} already linked (left untouched)`);
    console.log(`      ${unreferenced} referenced by nothing (left NULL)`);
    console.log(`      ${ambiguousRows.length} ambiguous (skipped)`);
    console.log(`      ${orphanRefs.length} referenced ids with no Prices row`);

    // Reported against the links this run is about to create, not the ones
    // already in the database, so the dry run shows the state the --apply run
    // would actually leave behind.
    const projectedPrices = prices.map((price) => ({
      ...price,
      productId: price.productId ?? resolved.get(price.id) ?? null,
    }));
    console.log(
      `      ${planPriceStockBackfill(products, projectedPrices).length} prices to inherit a sold-out product's flag`,
    );

    const perProduct = new Map<string, string[]>();
    toLink.forEach(({ id, productId }) => {
      perProduct.set(productId, [...(perProduct.get(productId) ?? []), id]);
    });

    if (perProduct.size > 0) {
      console.log('\n  Links to create, by product:');
      [...perProduct.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([productId, ids]) => {
          console.log(
            `    ${String(ids.length).padStart(5)}  ${nameOf(productId)}`,
          );
        });
    }

    if (ambiguousRows.length > 0) {
      console.log(
        '\n  ⚠️  Ambiguous — referenced by several products, left NULL for manual review:',
      );
      ambiguousRows.forEach(({ id, name, productIds }) => {
        console.log(
          `    ${id}  "${bareName(name)}"  ->  ${productIds.map(nameOf).join(' | ')}`,
        );
      });
    }

    if (orphanRefs.length > 0) {
      console.log(
        '\n  ⚠️  Products reference these price ids, but no Prices row exists:',
      );
      orphanRefs.forEach((priceId) => console.log(`    ${priceId}`));
    }

    if (!apply) {
      console.log(
        '\n  DRY RUN — nothing written. Re-run with --apply to commit.',
      );
      return;
    }

    if (toLink.length === 0) {
      console.log('\n  ✅ Nothing to link.');
    } else {
      // The `productId: null` guard keeps this idempotent and stops a concurrent
      // admin edit between the read above and the write below from being clobbered.
      const results = await dbClient.$transaction(
        [...perProduct.entries()].map(([productId, ids]) =>
          dbClient.prices.updateMany({
            where: { id: { in: ids }, productId: null },
            data: { productId },
          }),
        ),
      );

      const updated = results.reduce((sum, r) => sum + r.count, 0);
      console.log(`\n  ✅ Linked ${updated} price rows.`);
      if (updated !== toLink.length) {
        console.log(
          `  ⚠️  Expected ${toLink.length}; ${toLink.length - updated} were linked by someone else mid-run. Re-run to see the current state.`,
        );
      }
    }

    // Second phase: carry each sold-out product's flag down onto the prices it
    // now owns. Runs even when there was nothing to link, so a re-run can still
    // repair stock state, and reads the links back rather than trusting the
    // projection above.
    //
    // This has to happen before the out-of-stock sync job ever runs. The new
    // Prices.outOfStockAt column starts null, so until it is filled every
    // sold-out product looks like it owns nothing but in-stock prices — and the
    // upward rule would derive the whole catalog back into stock, losing which
    // products were sold out in the first place.
    const linkedPrices = await dbClient.prices.findMany({
      select: { id: true, productId: true, outOfStockAt: true },
    });
    const stockPlan = planPriceStockBackfill(products, linkedPrices);

    if (stockPlan.length === 0) {
      console.log('  ✅ No price stock to carry over.');
      return;
    }

    const { count } = await dbClient.prices.updateMany({
      where: { id: { in: stockPlan }, outOfStockAt: null },
      data: { outOfStockAt: new Date() },
    });
    console.log(`  ✅ Marked ${count} prices out of stock from their product.`);
  } catch (error) {
    console.error('\n  ❌ Backfill failed:', error);
    process.exitCode = 1;
  } finally {
    await dbClient.$disconnect();
  }
}

// Guarded so tests can import deriveProductPrices without opening a DB
// connection or running the backfill.
if (typeof require !== 'undefined' && require.main === module) {
  main();
}
