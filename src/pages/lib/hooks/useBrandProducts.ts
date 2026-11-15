import { fetchProducts } from '@/pages/lib/apis';
import { HOME_RECOMMENDED_PRODUCTS, SORT_OPTIONS } from '@/pages/lib/constants';
import { ExtendedProduct } from '@/pages/lib/types';
import { useCallback, useEffect, useState } from 'react';

export interface BrandProducts {
  products: ExtendedProduct[];
  isLoading: boolean;
  failed: boolean;
  retry: () => void;
}

const NO_PRODUCTS: ExtendedProduct[] = [];

// Names and prices are localized, so a locale switch must not reuse the cache.
const cacheKey = (locale: string | undefined, brandId: string) =>
  `${locale}:${brandId}`;

/**
 * Recommended in-stock products of the brand picked on home. Each brand is
 * loaded once and cached, so flipping back to a brand is instant; `initial`
 * seeds the cache with the brand home was server-rendered with.
 */
export function useBrandProducts(
  brandId: string | null,
  locale: string | undefined,
  initial: { brandId: string; products: ExtendedProduct[] } | null,
): BrandProducts {
  const [cache] = useState(
    () =>
      new Map<string, ExtendedProduct[]>(
        initial ? [[cacheKey(locale, initial.brandId), initial.products]] : [],
      ),
  );
  // A server re-render on the same mount (the locale redirect) brings a fresh
  // seed. Only a new seed is taken: an old one kept across a locale change
  // would be filed under the new locale in the wrong language.
  const [seenInitial, setSeenInitial] = useState(initial);
  if (initial !== seenInitial) {
    setSeenInitial(initial);
    if (initial) cache.set(cacheKey(locale, initial.brandId), initial.products);
  }
  const [, setLoadedCount] = useState(0);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!brandId) return undefined;
    const key = cacheKey(locale, brandId);
    if (cache.has(key)) return undefined;
    let active = true;
    setFailedKey(null);
    fetchProducts({
      page: 1,
      brandIds: [brandId],
      inStock: true,
      sortBy: SORT_OPTIONS.RECOMMENDED,
      limit: HOME_RECOMMENDED_PRODUCTS,
      locale,
    })
      .then((products) => {
        // Always under the request's own key, so a stale response can never
        // be shown for the current brand/locale.
        cache.set(key, products);
        if (active) setLoadedCount((n) => n + 1);
      })
      .catch((error) => {
        console.error('Failed to load brand products:', error);
        if (active) setFailedKey(key);
      });
    return () => {
      active = false;
    };
  }, [brandId, locale, attempt, cache]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (!brandId) {
    return { products: NO_PRODUCTS, isLoading: false, failed: false, retry };
  }
  const cached = cache.get(cacheKey(locale, brandId));
  const failed = !cached && failedKey === cacheKey(locale, brandId);
  return {
    products: cached ?? NO_PRODUCTS,
    isLoading: !cached && !failed,
    failed,
    retry,
  };
}
