import type { AdminProductListItem } from '@/pages/api/product/admin-list.page';
import { parseName } from '@/pages/lib/utils';

export interface OverviewFilters {
  searchKeyword: string;
  /** Empty string means "all categories". */
  categoryId: string;
  outOfStockOnly: boolean;
  locale: string;
}

/**
 * Narrows the admin product list down to what the overview table shows.
 *
 * All three filters are AND-ed and applied client-side: `/api/product/admin-list`
 * returns a thin id/name/count payload for the whole catalog, so re-querying per
 * keystroke or per toggle would cost more than filtering what is already loaded.
 *
 * The name search goes through `parseName` rather than the raw JSON blob so it
 * matches the text actually rendered in the row — a product named only in
 * Turkmen still matches while the page is in English.
 */
/**
 * Orders the table by the name the row actually renders.
 *
 * `Product.name` is a localized JSON blob, so ordering it in the database sorts
 * by whichever locale key happens to come first inside each string — an order
 * with no relationship to what the admin is reading. Sorting belongs here, on
 * the client, because this is where the active locale is known.
 */
export function sortOverviewProducts(
  products: AdminProductListItem[],
  locale: string,
): AdminProductListItem[] {
  return [...products].sort((a, b) =>
    parseName(a.name, locale).localeCompare(parseName(b.name, locale)),
  );
}

export function filterOverviewProducts(
  products: AdminProductListItem[],
  { searchKeyword, categoryId, outOfStockOnly, locale }: OverviewFilters,
): AdminProductListItem[] {
  const keyword = searchKeyword.trim().toLowerCase();

  return products.filter((product) => {
    if (outOfStockOnly && !product.isOutOfStock) return false;
    if (categoryId !== '' && product.categoryId !== categoryId) return false;
    if (keyword === '') return true;
    return parseName(product.name, locale).toLowerCase().includes(keyword);
  });
}
