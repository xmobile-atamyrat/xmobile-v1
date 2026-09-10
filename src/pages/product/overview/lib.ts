import type { AdminProductListItem } from '@/pages/api/product/admin-list.page';
import { parseName } from '@/pages/lib/utils';

/**
 * Brand-filter sentinel for "products with no brand at all". A plain empty
 * string already means "any brand", so the absence of a brand needs a value of
 * its own — same trick the price table uses for its uncategorized filter.
 */
export const NO_BRAND_FILTER = '__noBrand__';

/**
 * A row's staged, not-yet-saved edits. A key being absent means "untouched",
 * which is what lets one save leave images, tags and the base price alone; a
 * present `brandId` of `null` is an explicit "unlink the brand".
 */
export interface ProductEdit {
  categoryId?: string;
  brandId?: string | null;
  isOutOfStock?: boolean;
}

/**
 * Turns staged edits into the multipart fields PUT /api/product expects.
 *
 * Kept separate from the page because the empty-string rule is easy to get
 * wrong and invisible until a brand refuses to clear: the handler reads
 * `fields.brandId[0] || null`, so `''` unlinks the brand while omitting the
 * field leaves the old one attached.
 */
export function buildProductEditFields(edit: ProductEdit): [string, string][] {
  const fields: [string, string][] = [];
  if (edit.categoryId != null) fields.push(['categoryId', edit.categoryId]);
  // `in` rather than a null check: null is a meaningful value here, and only
  // the key's absence means the admin never touched the brand.
  if ('brandId' in edit) fields.push(['brandId', edit.brandId ?? '']);
  if (edit.isOutOfStock != null) {
    fields.push(['isOutOfStock', String(edit.isOutOfStock)]);
  }
  return fields;
}

/** What typing a brand name into a row should actually do. */
export type BrandSelection =
  | { kind: 'existing'; id: string }
  | { kind: 'create'; name: string }
  | { kind: 'noop' };

/**
 * Decides whether a typed brand name means "pick this one" or "make a new one".
 *
 * `Brand.name` is uniquely indexed, so posting "apple" when "Apple" exists is a
 * database error rather than a second brand. Matching case-insensitively on the
 * already-loaded list turns that into a silent, correct pick — the same rule
 * AddEditProductDialog's brand box applies.
 */
export function resolveBrandSelection(
  brands: { id: string; name: string }[],
  rawName: string,
): BrandSelection {
  const name = rawName.trim();
  if (name === '') return { kind: 'noop' };

  const existing = brands.find(
    (brand) => brand.name.toLowerCase() === name.toLowerCase(),
  );
  return existing
    ? { kind: 'existing', id: existing.id }
    : { kind: 'create', name };
}

export type OverviewSortKey =
  | 'nameAsc'
  | 'nameDesc'
  | 'editedRecent'
  | 'editedStale'
  | 'priceAsc'
  | 'priceDesc';

export interface OverviewFilters {
  searchKeyword: string;
  /** Empty string means "all categories". */
  categoryId: string;
  outOfStockOnly: boolean;
  /** Empty string means "any brand"; NO_BRAND_FILTER means "no brand set". */
  brandId: string;
  /** Keeps only products whose base price is absent or points at a dead row. */
  missingPriceOnly: boolean;
  locale: string;
}

/**
 * Narrows the admin product list down to what the overview table shows.
 *
 * Every filter is AND-ed and applied client-side: `/api/product/admin-list`
 * returns a thin payload for the whole catalog, so re-querying per keystroke or
 * per toggle would cost more than filtering what is already loaded.
 *
 * The name search goes through `parseName` rather than the raw JSON blob so it
 * matches the text actually rendered in the row — a product named only in
 * Turkmen still matches while the page is in English.
 */
export function filterOverviewProducts(
  products: AdminProductListItem[],
  {
    searchKeyword,
    categoryId,
    outOfStockOnly,
    brandId,
    missingPriceOnly,
    locale,
  }: OverviewFilters,
): AdminProductListItem[] {
  const keyword = searchKeyword.trim().toLowerCase();

  return products.filter((product) => {
    if (outOfStockOnly && !product.isOutOfStock) return false;
    if (categoryId !== '' && product.categoryId !== categoryId) return false;
    // A product with no base price and one whose reference is dead are the same
    // problem to an admin — neither shows a price to a customer — so one filter
    // covers both. The column still distinguishes them.
    if (missingPriceOnly && product.basePriceIssue == null) return false;
    if (brandId === NO_BRAND_FILTER) {
      if (product.brandId != null) return false;
    } else if (brandId !== '' && product.brandId !== brandId) {
      return false;
    }
    if (keyword === '') return true;
    return parseName(product.name, locale).toLowerCase().includes(keyword);
  });
}

/**
 * Products with no comparable price sort last in both directions rather than
 * being treated as free. `Number.NaN` would make every comparison false and
 * leave them wherever the sort happened to drop them, so they get an explicit
 * sentinel instead.
 */
function comparablePrice(product: AdminProductListItem): number {
  // Guarded before the cast on purpose: `Number(null)` and `Number('')` are
  // both 0, which would sort an unpriced product as the cheapest thing in the
  // catalog rather than the missing data it actually is.
  const raw = product.basePriceTmt;
  if (raw == null || raw.trim() === '') return Number.POSITIVE_INFINITY;
  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

/**
 * Orders the table.
 *
 * Name sorting reads `parseName` rather than the stored blob: `Product.name` is
 * localized JSON, so ordering it in the database sorts by whichever locale key
 * happens to come first inside each string — an order with no relationship to
 * what the admin is reading. That is why sorting belongs here, on the client,
 * where the active locale is known.
 */
export function sortOverviewProducts(
  products: AdminProductListItem[],
  locale: string,
  sortKey: OverviewSortKey = 'nameAsc',
): AdminProductListItem[] {
  const byName = (a: AdminProductListItem, b: AdminProductListItem) =>
    parseName(a.name, locale).localeCompare(parseName(b.name, locale));

  const sorted = [...products];
  switch (sortKey) {
    case 'nameDesc':
      return sorted.sort((a, b) => byName(b, a));
    case 'editedRecent':
      return sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case 'editedStale':
      return sorted.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    case 'priceAsc':
      return sorted.sort((a, b) => comparablePrice(a) - comparablePrice(b));
    case 'priceDesc':
      // Unpriced rows stay last here too, so the descending view opens on the
      // most expensive product rather than on a wall of blanks.
      return sorted.sort((a, b) => {
        const [left, right] = [comparablePrice(a), comparablePrice(b)];
        if (left === Number.POSITIVE_INFINITY) return 1;
        if (right === Number.POSITIVE_INFINITY) return -1;
        return right - left;
      });
    case 'nameAsc':
    default:
      return sorted.sort(byName);
  }
}
