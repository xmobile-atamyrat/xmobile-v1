/**
 * Backfills `Prices.categoryId` from the products that reference each price.
 *
 * Prices carry no category of their own; the link is implicit in each product's
 * `price` ("[priceId]") and its `tags` ("128gb 12gb ram [priceId]{colorId}").
 * This persists that derivation into the column added by the
 * 20260810135544_add_price_category_relation migration.
 *
 * Only fills rows where `categoryId IS NULL` — existing links are treated as
 * hand-curated and are never overwritten, which also makes re-runs a no-op.
 *
 *   yarn backfill:price-categories-dev            # preview, writes nothing
 *   yarn backfill:price-categories-dev --apply    # commit
 *   yarn backfill:price-categories-prod --apply   # against .env
 */
import { PrismaClient } from '@prisma/client';

export interface ProductRef {
  price: string | null;
  tags: string[];
  categoryId: string;
}

export interface DerivedCategories {
  /** priceId -> the single categoryId every referencing product agrees on. */
  resolved: Map<string, string>;
  /** priceId -> the competing categoryIds, when products disagree. */
  ambiguous: Map<string, string[]>;
}

// Kept in sync with src/pages/api/prices/categories.page.ts, which derives the
// same map at request time. Duplicated rather than imported from
// @/pages/lib/constants because this script runs without tsconfig-paths, and
// the obvious alternative — parseVariantTag in src/pages/product/utils.ts —
// drags xlsx and papaparse into a database migration.
const squareBracketRegex = /\[([^\]]+)\]/;

export function derivePriceCategories(
  products: ProductRef[],
): DerivedCategories {
  const sets = new Map<string, Set<string>>();

  const add = (raw: string | null, categoryId: string) => {
    const priceId = raw?.match(squareBracketRegex)?.[1];
    if (priceId == null) return;
    const categories = sets.get(priceId) ?? new Set<string>();
    categories.add(categoryId);
    sets.set(priceId, categories);
  };

  products.forEach(({ price, tags, categoryId }) => {
    add(price, categoryId);
    tags.forEach((tag) => add(tag, categoryId));
  });

  const resolved = new Map<string, string>();
  const ambiguous = new Map<string, string[]>();

  sets.forEach((categories, priceId) => {
    if (categories.size === 1) {
      resolved.set(priceId, [...categories][0]);
    } else {
      ambiguous.set(priceId, [...categories]);
    }
  });

  return { resolved, ambiguous };
}

// Category/product names are stored as localized JSON blobs; fall back to the
// raw value when they are plain strings.
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
    console.log(
      '--- Backfill: Prices.categoryId from product references ---\n',
    );

    const [products, prices, categories] = await Promise.all([
      dbClient.product.findMany({
        where: { deletedAt: null },
        select: { price: true, tags: true, categoryId: true },
      }),
      dbClient.prices.findMany({
        select: { id: true, name: true, categoryId: true },
      }),
      dbClient.category.findMany({ select: { id: true, name: true } }),
    ]);

    const categoryNames = new Map(
      categories.map((c) => [c.id, bareName(c.name)]),
    );
    const nameOf = (id: string) => categoryNames.get(id) ?? `<unknown ${id}>`;

    const { resolved, ambiguous } = derivePriceCategories(products);

    const toLink: { id: string; name: string; categoryId: string }[] = [];
    const ambiguousRows: { id: string; name: string; categoryIds: string[] }[] =
      [];
    let alreadyLinked = 0;
    let unreferenced = 0;

    prices.forEach(({ id, name, categoryId }) => {
      if (categoryId != null) {
        alreadyLinked += 1;
      } else if (ambiguous.has(id)) {
        ambiguousRows.push({ id, name, categoryIds: ambiguous.get(id)! });
      } else if (resolved.has(id)) {
        toLink.push({ id, name, categoryId: resolved.get(id)! });
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

    const perCategory = new Map<string, string[]>();
    toLink.forEach(({ id, categoryId }) => {
      perCategory.set(categoryId, [...(perCategory.get(categoryId) ?? []), id]);
    });

    if (perCategory.size > 0) {
      console.log('\n  Links to create, by category:');
      [...perCategory.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([categoryId, ids]) => {
          console.log(
            `    ${String(ids.length).padStart(5)}  ${nameOf(categoryId)}`,
          );
        });
    }

    if (ambiguousRows.length > 0) {
      console.log(
        '\n  ⚠️  Ambiguous — referenced from several categories, left NULL for manual review:',
      );
      ambiguousRows.forEach(({ id, name, categoryIds }) => {
        console.log(
          `    ${id}  "${bareName(name)}"  ->  ${categoryIds.map(nameOf).join(' | ')}`,
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
      return;
    }

    // The `categoryId: null` guard keeps this idempotent and stops a concurrent
    // admin edit between the read above and the write below from being clobbered.
    const results = await dbClient.$transaction(
      [...perCategory.entries()].map(([categoryId, ids]) =>
        dbClient.prices.updateMany({
          where: { id: { in: ids }, categoryId: null },
          data: { categoryId },
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
  } catch (error) {
    console.error('\n  ❌ Backfill failed:', error);
    process.exitCode = 1;
  } finally {
    await dbClient.$disconnect();
  }
}

// Guarded so tests can import derivePriceCategories without opening a DB
// connection or running the backfill.
if (typeof require !== 'undefined' && require.main === module) {
  main();
}
