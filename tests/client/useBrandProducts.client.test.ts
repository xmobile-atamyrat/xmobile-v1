// @vitest-environment jsdom

import { fetchProducts } from '@/pages/lib/apis';
import { useBrandProducts } from '@/pages/lib/hooks/useBrandProducts';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/lib/apis', () => ({ fetchProducts: vi.fn() }));

const p1 = { id: 'p1' } as never;
const p2 = { id: 'p2' } as never;

describe('useBrandProducts', () => {
  beforeEach(() => {
    vi.mocked(fetchProducts).mockReset();
  });

  it('fetches the selected brand with the recommended sort', async () => {
    vi.mocked(fetchProducts).mockResolvedValue([p1]);
    const { result } = renderHook(() => useBrandProducts('b1', 'en', null));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.products).toEqual([p1]));
    expect(result.current.isLoading).toBe(false);
    expect(fetchProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        brandIds: ['b1'],
        inStock: true,
        sortBy: 'recommended',
        limit: 20,
        locale: 'en',
      }),
    );
  });

  it('does nothing without a selected brand', () => {
    const { result } = renderHook(() => useBrandProducts(null, 'en', null));
    expect(result.current).toMatchObject({
      products: [],
      isLoading: false,
      failed: false,
    });
    expect(fetchProducts).not.toHaveBeenCalled();
  });

  it('uses the seeded products without fetching', () => {
    const { result } = renderHook(() =>
      useBrandProducts('b1', 'en', { brandId: 'b1', products: [p1] }),
    );
    expect(result.current.products).toEqual([p1]);
    expect(result.current.isLoading).toBe(false);
    expect(fetchProducts).not.toHaveBeenCalled();
  });

  it('does not refetch a brand it already loaded', async () => {
    vi.mocked(fetchProducts).mockImplementation(
      async ({ brandIds }) => (brandIds?.[0] === 'b1' ? [p1] : [p2]) as never,
    );
    const { result, rerender } = renderHook(
      ({ id }) => useBrandProducts(id, 'en', null),
      { initialProps: { id: 'b1' } },
    );
    await waitFor(() => expect(result.current.products).toEqual([p1]));
    rerender({ id: 'b2' });
    await waitFor(() => expect(result.current.products).toEqual([p2]));
    rerender({ id: 'b1' });
    expect(result.current.products).toEqual([p1]);
    expect(fetchProducts).toHaveBeenCalledTimes(2);
  });

  it('drops a late response for a brand no longer selected', async () => {
    let resolveB1: (v: never) => void = () => {};
    vi.mocked(fetchProducts).mockImplementation(({ brandIds }) =>
      brandIds?.[0] === 'b1'
        ? new Promise((resolve) => {
            resolveB1 = resolve as never;
          })
        : (Promise.resolve([p2]) as never),
    );
    const { result, rerender } = renderHook(
      ({ id }) => useBrandProducts(id, 'en', null),
      { initialProps: { id: 'b1' } },
    );
    rerender({ id: 'b2' });
    await waitFor(() => expect(result.current.products).toEqual([p2]));
    await act(async () => {
      resolveB1([p1] as never);
    });
    expect(result.current.products).toEqual([p2]);
    expect(result.current.products).not.toContain(p1);
    expect(fetchProducts).toHaveBeenCalledTimes(2);
  });

  it('refetches a loaded brand when the locale changes', async () => {
    vi.mocked(fetchProducts).mockImplementation(
      async ({ locale }) => [{ id: `p-${locale}` }] as never,
    );
    const { result, rerender } = renderHook(
      ({ locale }) => useBrandProducts('b1', locale, null),
      { initialProps: { locale: 'en' } },
    );
    await waitFor(() =>
      expect(result.current.products).toEqual([{ id: 'p-en' }]),
    );
    rerender({ locale: 'ru' });
    await waitFor(() =>
      expect(result.current.products).toEqual([{ id: 'p-ru' }]),
    );
    expect(fetchProducts).toHaveBeenCalledTimes(2);
    expect(fetchProducts).toHaveBeenLastCalledWith(
      expect.objectContaining({ brandIds: ['b1'], locale: 'ru' }),
    );
  });

  it('refetches the seeded brand when the locale changes', async () => {
    vi.mocked(fetchProducts).mockResolvedValue([p2]);
    // Server props keep their identity until the server renders again.
    const seed = { brandId: 'b1', products: [p1] };
    const { result, rerender } = renderHook(
      ({ locale }) => useBrandProducts('b1', locale, seed),
      { initialProps: { locale: 'en' } },
    );
    expect(result.current.products).toEqual([p1]);
    rerender({ locale: 'ru' });
    await waitFor(() => expect(result.current.products).toEqual([p2]));
    expect(fetchProducts).toHaveBeenCalledTimes(1);
  });

  it('takes a new seed for a new locale without fetching', () => {
    const { result, rerender } = renderHook(
      ({ locale, seed }) => useBrandProducts('b1', locale, seed),
      {
        initialProps: {
          locale: 'en',
          seed: { brandId: 'b1', products: [p1] },
        },
      },
    );
    expect(result.current.products).toEqual([p1]);
    rerender({ locale: 'ru', seed: { brandId: 'b1', products: [p2] } });
    expect(result.current.products).toEqual([p2]);
    expect(result.current.isLoading).toBe(false);
    expect(fetchProducts).not.toHaveBeenCalled();
  });

  it('never shows a stale-locale response for the current locale', async () => {
    let resolveEn: (v: never) => void = () => {};
    vi.mocked(fetchProducts).mockImplementation(({ locale }) =>
      locale === 'en'
        ? new Promise((resolve) => {
            resolveEn = resolve as never;
          })
        : (Promise.resolve([p2]) as never),
    );
    const { result, rerender } = renderHook(
      ({ locale }) => useBrandProducts('b1', locale, null),
      { initialProps: { locale: 'en' } },
    );
    rerender({ locale: 'ru' });
    await waitFor(() => expect(result.current.products).toEqual([p2]));
    await act(async () => {
      resolveEn([p1] as never);
    });
    expect(result.current.products).toEqual([p2]);
    rerender({ locale: 'ru' });
    expect(result.current.products).toEqual([p2]);
  });

  it('reports failure and retries', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetchProducts)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([p1]);
    const { result } = renderHook(() => useBrandProducts('b1', 'en', null));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.isLoading).toBe(false);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.products).toEqual([p1]));
    expect(result.current.failed).toBe(false);
    expect(fetchProducts).toHaveBeenCalledTimes(2);
  });
});
