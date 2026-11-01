// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
