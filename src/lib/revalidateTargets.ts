import dbClient from '@/lib/dbClient';
import {
  categoryPaths,
  productCategoryPaths,
  productPaths,
} from '@/lib/revalidate';

/**
 * Maps mutated catalog rows onto the ISR paths they invalidate. Kept apart from
 * `@/lib/revalidate` so the mechanism stays free of schema knowledge.
 *
 * Neither query filters on `deletedAt`: a row that was just soft-deleted still
 * has a cached page, and rebuilding it into a 404 is the whole point.
 */

function uniqueIds(ids: (string | null | undefined)[]): string[] {
  return [
    ...new Set(ids.filter((id): id is string => id != null && id !== '')),
  ];
}

/**
 * Each product's detail pages, plus the listing page of every category those
 * products sit in — the listing seeds its first page of products server-side,
 * so a product edit changes it too.
 */
export async function productRevalidationPaths(
  productIds: (string | null | undefined)[],
): Promise<string[]> {
  const ids = uniqueIds(productIds);
  if (ids.length === 0) return [];

  const products = await dbClient.product.findMany({
    where: { id: { in: ids } },
    // `categories` is the relation name for the single owning category.
    select: { slug: true, categories: { select: { slug: true } } },
  });

  const paths = products.flatMap((product) => productPaths(product.slug));
  const categorySlugs = new Set(
    products
      .map((product) => product.categories?.slug)
      .filter((slug): slug is string => slug != null),
  );
  categorySlugs.forEach((slug) => paths.push(...productCategoryPaths(slug)));

  return paths;
}

/**
 * Products a set of price rows belongs to, by every link the schema actually
 * uses.
 *
 * `Prices.productId` is not sufficient on its own: it was backfilled from the
 * bracket references inside `Product.price`/`Product.tags`, and
 * scripts/backfill-product-prices.ts deliberately leaves a price NULL when more
 * than one product claims it. So a null FK is a normal steady state, not just an
 * un-migrated one, and the string reference is what the page actually renders
 * from. This mirrors the matcher the `cachedPrice` sync already uses in
 * src/pages/api/prices/index.page.ts.
 *
 * Scoped to `price` rather than `tags` on purpose: only the base price reaches
 * the static HTML (meta description, JSON-LD, and the grid the category listing
 * seeds). Variant prices behind `tags` are fetched client-side on every view, so
 * no cached page goes stale when one changes.
 */
export async function productIdsReferencingPrices(
  priceIds: (string | null | undefined)[],
): Promise<string[]> {
  const ids = uniqueIds(priceIds);
  if (ids.length === 0) return [];

  const products = await dbClient.product.findMany({
    where: {
      OR: [
        { prices: { some: { id: { in: ids } } } },
        ...ids.map((id) => ({ price: id })),
        ...ids.map((id) => ({ price: { contains: `[${id}]` } })),
      ],
    },
    select: { id: true },
  });

  return products.map((product) => product.id);
}

async function slugsForCategories(ids: string[]): Promise<string[]> {
  const categories = await dbClient.category.findMany({
    where: { id: { in: ids } },
    select: { slug: true },
  });
  return categories
    .map((category) => category.slug)
    .filter((slug): slug is string => slug != null);
}

/**
 * A category owns two pages: `/category/{slug}` (its subcategory grid) and
 * `/product-category/{slug}` (its product listing). Both carry its name.
 */
export async function categoryRevalidationPaths(
  categoryIds: (string | null | undefined)[],
): Promise<string[]> {
  const ids = uniqueIds(categoryIds);
  if (ids.length === 0) return [];

  const slugs = await slugsForCategories(ids);
  return slugs.flatMap((slug) => [
    ...categoryPaths(slug),
    ...productCategoryPaths(slug),
  ]);
}

/**
 * Listing pages only. What a product gaining or losing a category invalidates —
 * `/category/{slug}` shows subcategories, not products, so it is left alone.
 */
export async function categoryListingPaths(
  categoryIds: (string | null | undefined)[],
): Promise<string[]> {
  const ids = uniqueIds(categoryIds);
  if (ids.length === 0) return [];

  const slugs = await slugsForCategories(ids);
  return slugs.flatMap((slug) => productCategoryPaths(slug));
}
