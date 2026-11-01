import { fetchProducts } from '@/pages/lib/apis';
import { PRODUCTS_PER_PAGE } from '@/pages/lib/constants';
import { ExtendedProduct } from '@/pages/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Search-as-you-type results for the home page, which shows them in place of
 * its banner instead of sending the user off to /product.
 *
 * Same generation token as ProductGridContent: the term changes while requests
 * are in flight, and without it a slow response for an older term would land
 * on top of the newer results (or append onto a list that has been reset).
 *
 * The API returns exactly PRODUCTS_PER_PAGE rows per full page, so a short page
 * ends the list without spending another round-trip on an empty one.
 *
 * `seed` is page 1 as rendered by getServerSideProps; while the term still
 * matches it, the mount fetch is skipped.
 */
export function useHomeSearch(
  keyword: string,
  locale?: string,
  seed?: { term: string; results: ExtendedProduct[] } | null,
) {
  const term = keyword.trim();
  const seeded = seed != null && seed.term === term ? seed.results : null;
  const [results, setResults] = useState<ExtendedProduct[]>(seeded ?? []);
  const [page, setPage] = useState(seeded ? 1 : 0);
  const [hasMore, setHasMore] = useState(
    (seeded?.length ?? 0) >= PRODUCTS_PER_PAGE,
  );
  const [isLoading, setIsLoading] = useState(false);
  const generationRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // The query the list on screen belongs to. Compared rather than consumed, so
  // a dev StrictMode double-run of the effect doesn't refetch the seed.
  const loadedKeyRef = useRef(seeded ? `${term}\n${locale}` : null);

  useEffect(() => {
    const key = `${term}\n${locale}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    generationRef.current += 1;
    const generation = generationRef.current;
    const isCurrent = () => generation === generationRef.current;
    setResults([]);
    setPage(0);
    setHasMore(false);
    if (!term) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchProducts({ page: 1, searchKeyword: term, locale })
      .then((fetched) => {
        if (!isCurrent()) return;
        setResults(fetched);
        setPage(1);
        setHasMore(fetched.length >= PRODUCTS_PER_PAGE);
      })
      .catch((error) => console.error('Failed to search products:', error))
      .finally(() => {
        if (isCurrent()) setIsLoading(false);
      });
  }, [term, locale]);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore || !term) return;
    // Continues the query on screen, so it checks the token instead of bumping it.
    const generation = generationRef.current;
    const isCurrent = () => generation === generationRef.current;
    const nextPage = page + 1;
    setIsLoading(true);
    fetchProducts({ page: nextPage, searchKeyword: term, locale })
      .then((fetched) => {
        if (!isCurrent()) return;
        setResults((prev) => [...prev, ...fetched]);
        setPage(nextPage);
        setHasMore(fetched.length >= PRODUCTS_PER_PAGE);
      })
      .catch((error) => console.error('Failed to load more products:', error))
      .finally(() => {
        if (isCurrent()) setIsLoading(false);
      });
  }, [isLoading, hasMore, term, page, locale]);

  // Re-observed whenever loadMore changes, so a sentinel that is still in view
  // after a page lands fires again instead of waiting for a scroll.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return () => undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '100px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  return {
    isSearching: term !== '',
    results,
    isLoading,
    hasMore,
    sentinelRef,
  };
}
