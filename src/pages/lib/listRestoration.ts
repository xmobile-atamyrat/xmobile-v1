import { Product } from '@prisma/client';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';

export interface ListSnapshot {
  products: Product[];
  page: number;
  hasMore: boolean;
  scrollY: number;
}

// ponytail: module-level Map — survives SPA back-nav (browser back, site back
// button, webview gesture — all history.back here), resets on hard reload.
const cache = new Map<string, ListSnapshot>();

// Key by window.location, not router.asPath: this is read in a useState
// initializer at mount, before router.isReady, where asPath may still lack the
// query string. window.location is always complete on the client. The query
// string encodes the filters, so each filter combo is its own entry.
export const listKey = () =>
  typeof window === 'undefined'
    ? ''
    : window.location.pathname + window.location.search;

export const getListSnapshot = (key: string) => cache.get(key);

export const setListSnapshot = (key: string, snap: ListSnapshot) =>
  cache.set(key, snap);

/**
 * Saves the list snapshot on navigation away and restores scroll on return.
 * The page reads the snapshot itself (getListSnapshot(listKey())) so it can
 * seed its useState from it, then passes live state + the snapshot in here.
 * Returns `restoringRef` — while true, the page must skip its page-1 fetch so
 * the restored list isn't clobbered.
 */
export function useListRestoration(
  current: { products: Product[]; page: number; hasMore: boolean },
  restored: ListSnapshot | undefined,
) {
  const router = useRouter();
  const restoringRef = useRef(!!restored);

  // Clear the restore guard after hydration settles. The filters hook re-sets
  // `filters` synchronously on mount, which would otherwise retrigger the
  // page-1 fetch and clobber the restored list; that rerun runs before this
  // timer fires, so it's skipped.
  // ponytail: setTimeout(0) is the knob — bump if a slow hydrate still clobbers.
  useEffect(() => {
    if (!restoringRef.current) return undefined;
    const id = setTimeout(() => {
      restoringRef.current = false;
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Restore scroll once, after the seeded list paints. Same product count is
  // restored, so layout height matches.
  // ponytail: one rAF; bump to a short timeout if deep restores land short.
  useEffect(() => {
    if (!restored) return undefined;
    const id = requestAnimationFrame(() =>
      window.scrollTo(0, restored.scrollY),
    );
    return () => cancelAnimationFrame(id);
  }, [restored]);

  // Save on leaving (captures final scrollY + list state). listKey() is still
  // the leaving page's URL at routeChangeStart.
  useEffect(() => {
    const key = listKey();
    const save = () => {
      setListSnapshot(key, {
        products: current.products,
        page: current.page,
        hasMore: current.hasMore,
        scrollY: window.scrollY,
      });
    };
    router.events.on('routeChangeStart', save);
    return () => router.events.off('routeChangeStart', save);
  }, [router, current.products, current.page, current.hasMore]);

  return { restoringRef };
}
