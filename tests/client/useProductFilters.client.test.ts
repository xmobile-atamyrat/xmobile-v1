// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
const mockRouter = {
  isReady: true,
  pathname: '/product',
  query: {} as Record<string, string | string[]>,
  push: mockPush,
};
vi.mock('next/router', () => ({ useRouter: () => mockRouter }));

// eslint-disable-next-line import/first
import { useProductFilters } from '@/pages/lib/hooks/useProductFilters';

const pushedQuery = () => mockPush.mock.calls.at(-1)?.[0].query;

describe('useProductFilters inStock', () => {
  afterEach(() => {
    mockRouter.query = {};
    vi.clearAllMocks();
  });

  it('reads the flag from the URL', () => {
    mockRouter.query = { inStock: '1' };
    const { result } = renderHook(() => useProductFilters());

    expect(result.current.filters.inStock).toBe(true);
  });

  it('defaults to showing everything', () => {
    const { result } = renderHook(() => useProductFilters());

    expect(result.current.filters.inStock).toBe(false);
  });

  it('writes the flag to the URL when turned on', () => {
    const { result } = renderHook(() => useProductFilters());

    act(() => {
      result.current.setFilters({ inStock: true });
    });

    expect(pushedQuery()).toMatchObject({ inStock: '1' });
  });

  it('drops the flag from the URL when turned off', () => {
    mockRouter.query = { inStock: '1', searchKeyword: 'iphone' };
    const { result } = renderHook(() => useProductFilters());

    act(() => {
      result.current.setFilters({ inStock: false });
    });

    expect(pushedQuery()).toEqual({ searchKeyword: 'iphone' });
  });
});
