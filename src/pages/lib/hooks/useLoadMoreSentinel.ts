import { MutableRefObject, RefObject, useEffect } from 'react';

/**
 * Infinite scroll: calls `loadMore` whenever the sentinel is in view.
 *
 * Re-observed whenever `loadMore` changes, so a sentinel that is still in view
 * after a page lands fires again instead of waiting for a scroll. A failed page
 * would retry in a tight loop the same way, so the caller sets `pausedRef` when
 * one fails: the next try then waits for the sentinel to leave the view and come
 * back, and a dropped request doesn't end the list for good.
 */
export function useLoadMoreSentinel({
  sentinelRef,
  pausedRef,
  loadMore,
  enabled,
}: {
  sentinelRef: RefObject<HTMLElement>;
  pausedRef: MutableRefObject<boolean>;
  loadMore: () => void;
  enabled: boolean;
}) {
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !enabled) return () => undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) {
          // eslint-disable-next-line no-param-reassign
          pausedRef.current = false;
        } else if (!pausedRef.current) {
          loadMore();
        }
      },
      { rootMargin: '100px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [sentinelRef, pausedRef, loadMore, enabled]);
}
