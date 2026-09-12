import type { NextRouter } from 'next/router';
import type { ParsedUrlQuery } from 'querystring';

/**
 * Query key carrying the active search term on the product listing.
 *
 * The term has to live in the URL rather than only in ProductContext. The
 * list-restoration cache (listRestoration.ts) is keyed by pathname + search, so
 * a keyword held only in context made "/product" mean both "all products" and
 * "results for X": coming back to the listing in a different search state
 * restored the other one's products, and `restoringRef` then suppressed the
 * refetch that would have corrected it. Putting the term in the URL gives each
 * search its own cache entry, and makes results linkable as a side effect --
 * product/index.page.tsx's getServerSideProps already reads this exact param to
 * build the search page title.
 */
export const SEARCH_QUERY_KEY = 'searchKeyword';

/** The unscoped product listing. Category landings render the same grid. */
export const PRODUCT_LISTING_PATHNAME = '/product';

/**
 * Routes that render ProductGridContent, i.e. the pages that read the term off
 * the URL. `router.pathname` values (route patterns, not resolved paths).
 */
const LISTING_PATHNAMES = [
  PRODUCT_LISTING_PATHNAME,
  '/product-category/[categorySlug]',
];

/**
 * Whether the user is already looking at a product grid. On these routes a new
 * term retargets the current URL; anywhere else it has to navigate to one.
 */
export function isProductListingRoute(pathname: string): boolean {
  return LISTING_PATHNAMES.includes(pathname);
}

/** The active search term in a router query; '' when there is none. */
export function readSearchKeyword(query: ParsedUrlQuery): string {
  const raw = query[SEARCH_QUERY_KEY];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * The path (with query) the listing occupies for `keyword`. Mirrors the shape
 * `listKey()` builds its cache key from, so distinct terms are distinct entries.
 */
export function productSearchPath(keyword: string): string {
  const term = keyword.trim();
  if (!term) return PRODUCT_LISTING_PATHNAME;
  return `${PRODUCT_LISTING_PATHNAME}?${SEARCH_QUERY_KEY}=${encodeURIComponent(
    term,
  )}`;
}

/**
 * Sends the user to the listing for `keyword` from anywhere else (header
 * search, the mobile search screen, the 404 page). Drops any filters that were
 * on the previous URL -- a fresh search starts unscoped.
 */
export function pushProductSearch(router: NextRouter, keyword: string) {
  const term = keyword.trim();
  return router.push({
    pathname: PRODUCT_LISTING_PATHNAME,
    query: term ? { [SEARCH_QUERY_KEY]: term } : {},
  });
}

/**
 * Retargets the term on a listing the user is already on, keeping the filter
 * params. `replace`, not `push`, so search-as-you-type doesn't leave a history
 * entry per keystroke; shallow, because the page reads the term off the query
 * itself and no getServerSideProps rerun is needed.
 *
 * Uses `router.pathname` so a search inside a category landing page stays on
 * that page (and stays scoped to it) instead of jumping to /product.
 */
export function replaceProductSearch(router: NextRouter, keyword: string) {
  const term = keyword.trim();
  const query: ParsedUrlQuery = { ...router.query };
  if (term) query[SEARCH_QUERY_KEY] = term;
  else delete query[SEARCH_QUERY_KEY];
  return router.replace({ pathname: router.pathname, query }, undefined, {
    shallow: true,
  });
}
