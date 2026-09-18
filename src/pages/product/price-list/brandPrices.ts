import { squareBracketRegex } from '@/pages/lib/constants';
import { parseVariantTag } from '@/pages/product/utils';

/** The fields of a product that can point at a price. */
export interface BrandPriceSource {
  brandId: string | null;
  price: string | null;
  tags: string[];
}

/**
 * The prices each brand reaches, keyed by brand id.
 *
 * Prices carry no brand of their own: a product names its brand and points at
 * prices, so the brand of a price is whichever brands sell it. Mirrors the
 * derive-from-products approach in api/prices/categories.page.ts.
 *
 * A product's `price` is `[priceId]{value}`, though older rows store the bare
 * id — the same two shapes /api/prices keys its cachedPrice sync on. Variant
 * tags always bracket their reference, so their spec text ("128gb 8gb ram") is
 * never mistaken for an id.
 *
 * Lives apart from ./lib so API routes can derive the map without pulling in
 * that module's exceljs dependency.
 */
export const collectBrandPriceIds = (
  products: BrandPriceSource[],
): Record<string, string[]> => {
  const sets: Record<string, Set<string>> = {};
  const add = (brandId: string, priceId: string) => {
    (sets[brandId] ??= new Set()).add(priceId);
  };

  products.forEach(({ brandId, price, tags }) => {
    if (brandId == null) return;

    const bracketed = price?.match(squareBracketRegex)?.[1];
    const bare = price?.trim();
    if (bracketed != null) add(brandId, bracketed);
    else if (bare) add(brandId, bare);

    tags.forEach((tag) => {
      const { priceId } = parseVariantTag(tag);
      if (priceId) add(brandId, priceId);
    });
  });

  const map: Record<string, string[]> = {};
  Object.keys(sets).forEach((brandId) => {
    map[brandId] = [...sets[brandId]];
  });
  return map;
};
