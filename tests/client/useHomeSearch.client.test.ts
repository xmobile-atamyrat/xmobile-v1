// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchProducts = vi.fn();
vi.mock('@/pages/lib/apis', () => ({
  fetchProducts: (...args: unknown[]) => fetchProducts(...args),
}));

// eslint-disable-next-line import/first
import { useHomeSearch } from '@/pages/lib/hooks/useHomeSearch';

const products = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}` }));

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('useHomeSearch', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not search for an empty or blank keyword', () => {
    const { result } = renderHook(() => useHomeSearch('   ', 'ru'));

    expect(result.current.isSearching).toBe(false);
    expect(fetchProducts).not.toHaveBeenCalled();
  });

  it('fetches the first page for the trimmed keyword', async () => {
    fetchProducts.mockResolvedValueOnce(products('a', 3));
    const { result } = renderHook(() => useHomeSearch(' iphone ', 'tk'));

    await waitFor(() => expect(result.current.results).toHaveLength(3));
    expect(fetchProducts).toHaveBeenCalledWith({
      page: 1,
      searchKeyword: 'iphone',
      locale: 'tk',
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasMore).toBe(false);
  });

  it('keeps paging only after a full page', async () => {
    fetchProducts.mockResolvedValueOnce(products('a', 20));
    const { result } = renderHook(() => useHomeSearch('iphone', 'ru'));

    await waitFor(() => expect(result.current.results).toHaveLength(20));
    expect(result.current.hasMore).toBe(true);
  });

  it('drops a slower response for an older keyword', async () => {
    const slow = deferred<unknown[]>();
    fetchProducts
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(products('new', 2));
    const { result, rerender } = renderHook(
      ({ keyword }) => useHomeSearch(keyword, 'ru'),
      { initialProps: { keyword: 'iph' } },
    );

    rerender({ keyword: 'iphone' });
    await waitFor(() => expect(result.current.results).toHaveLength(2));
    await act(async () => {
      slow.resolve(products('old', 5));
    });

    expect(result.current.results.map((p) => p.id)).toEqual(['new-0', 'new-1']);
    expect(result.current.isLoading).toBe(false);
  });

  it('uses the server-rendered page instead of refetching it', () => {
    const seed = { term: 'iphone', results: products('ssr', 20) as never[] };
    const { result } = renderHook(() => useHomeSearch('iphone', 'ru', seed));

    expect(fetchProducts).not.toHaveBeenCalled();
    expect(result.current.results).toHaveLength(20);
    expect(result.current.hasMore).toBe(true);
  });

  it('fetches when the term moves off the seeded one', async () => {
    fetchProducts.mockResolvedValueOnce(products('new', 1));
    const seed = { term: 'iphone', results: products('ssr', 3) as never[] };
    const { result, rerender } = renderHook(
      ({ keyword }) => useHomeSearch(keyword, 'ru', seed),
      { initialProps: { keyword: 'iphone' } },
    );

    rerender({ keyword: 'samsung' });

    await waitFor(() =>
      expect(result.current.results.map((p) => p.id)).toEqual(['new-0']),
    );
    expect(fetchProducts).toHaveBeenCalledWith({
      page: 1,
      searchKeyword: 'samsung',
      locale: 'ru',
    });
  });

  describe('loading more from the sentinel', () => {
    type Entries = [{ isIntersecting: boolean }];
    const observers = new Set<{ callback: (entries: Entries) => void }>();
    let inView = true;

    // Like the real one, reports the current state right after observe().
    class FakeObserver {
      callback: (entries: Entries) => void;

      constructor(callback: (entries: Entries) => void) {
        this.callback = callback;
      }

      observe() {
        observers.add(this);
        queueMicrotask(() => {
          if (observers.has(this)) this.callback([{ isIntersecting: inView }]);
        });
      }

      disconnect() {
        observers.delete(this);
      }
    }

    const scroll = (visible: boolean) =>
      act(async () => {
        inView = visible;
        observers.forEach(({ callback }) =>
          callback([{ isIntersecting: visible }]),
        );
      });

    // Takes a moment like a real request. An instant rejection batches with the
    // loading flag, so the render that restarts the observer never happens.
    const offline = () =>
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('offline')), 5);
      });

    // Outside act(), which would hold back the renders a retry loop runs on.
    const settle = () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

    function renderSearch() {
      const hook = renderHook(({ keyword }) => useHomeSearch(keyword, 'ru'), {
        initialProps: { keyword: 'iphone' },
      });
      const { sentinelRef } = hook.result.current;
      (sentinelRef as MutableRefObject<HTMLDivElement>).current =
        document.createElement('div');
      return hook;
    }

    beforeEach(() => {
      observers.clear();
      inView = true;
      fetchProducts.mockReset();
      vi.stubGlobal('IntersectionObserver', FakeObserver);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      fetchProducts.mockReset();
    });

    it('keeps going while the sentinel stays in view', async () => {
      fetchProducts
        .mockResolvedValueOnce(products('a', 20))
        .mockResolvedValueOnce(products('b', 20))
        .mockResolvedValueOnce(products('c', 3));

      const { result } = renderSearch();

      await waitFor(() => expect(result.current.results).toHaveLength(43));
      expect(result.current.hasMore).toBe(false);
    });

    it('does not retry a failed page while the sentinel stays in view', async () => {
      fetchProducts
        .mockResolvedValueOnce(products('a', 20))
        .mockImplementation(offline);

      const { result } = renderSearch();

      await waitFor(() => expect(fetchProducts).toHaveBeenCalledTimes(2));
      await settle();
      expect(fetchProducts).toHaveBeenCalledTimes(2);
      expect(result.current.isLoading).toBe(false);
    });

    it('retries a failed page once the sentinel comes back into view', async () => {
      fetchProducts
        .mockResolvedValueOnce(products('a', 20))
        .mockImplementationOnce(offline)
        .mockResolvedValueOnce(products('b', 3));
      const { result } = renderSearch();
      await waitFor(() => expect(fetchProducts).toHaveBeenCalledTimes(2));
      await settle();

      await scroll(false);
      await scroll(true);

      await waitFor(() => expect(result.current.results).toHaveLength(23));
    });

    it('does not carry a failure over to a new keyword', async () => {
      fetchProducts
        .mockResolvedValueOnce(products('a', 20))
        .mockImplementationOnce(offline)
        .mockResolvedValueOnce(products('b', 20))
        .mockResolvedValueOnce(products('c', 3));
      const { result, rerender } = renderSearch();
      await waitFor(() => expect(fetchProducts).toHaveBeenCalledTimes(2));
      await settle();

      rerender({ keyword: 'ipad' });

      await waitFor(() => expect(result.current.results).toHaveLength(23));
    });
  });

  it('clears the results once the keyword is emptied', async () => {
    fetchProducts.mockResolvedValueOnce(products('a', 3));
    const { result, rerender } = renderHook(
      ({ keyword }) => useHomeSearch(keyword, 'ru'),
      { initialProps: { keyword: 'iphone' } },
    );
    await waitFor(() => expect(result.current.results).toHaveLength(3));

    rerender({ keyword: '' });

    expect(result.current.isSearching).toBe(false);
    expect(result.current.results).toEqual([]);
  });
});
