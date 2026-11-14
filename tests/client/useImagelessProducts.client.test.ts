// @vitest-environment jsdom

import { fetchProducts, fetchProductsCount } from '@/pages/lib/apis';
import { useImagelessProducts } from '@/pages/lib/hooks/useImagelessProducts';
import { useUserContext } from '@/pages/lib/UserContext';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/lib/UserContext', () => ({ useUserContext: vi.fn() }));
vi.mock('@/pages/lib/apis', () => ({
  fetchProducts: vi.fn(),
  fetchProductsCount: vi.fn(),
}));

const signIn = (grade: string | undefined, accessToken?: string) =>
  vi.mocked(useUserContext).mockReturnValue({
    user: grade ? { id: 'u1', grade } : undefined,
    accessToken,
  } as never);

describe('useImagelessProducts', () => {
  beforeEach(() => {
    vi.mocked(fetchProducts).mockReset();
    vi.mocked(fetchProductsCount).mockReset();
    vi.mocked(fetchProducts).mockResolvedValue([{ id: 'p1' }] as never);
    vi.mocked(fetchProductsCount).mockResolvedValue(3);
  });

  it.each([
    ['a shopper', 'FREE', 'token'],
    ['a signed-out visitor', undefined, undefined],
  ])('asks for nothing for %s', async (_, grade, token) => {
    signIn(grade, token);
    const { result } = renderHook(() => useImagelessProducts('en'));
    await Promise.resolve();
    expect(result.current).toBeNull();
    expect(fetchProducts).not.toHaveBeenCalled();
    expect(fetchProductsCount).not.toHaveBeenCalled();
  });

  it.each(['ADMIN', 'SUPERUSER'])(
    'loads the list and total for %s with the staff token',
    async (grade) => {
      signIn(grade, 'token');
      const { result } = renderHook(() => useImagelessProducts('en'));
      await waitFor(() =>
        expect(result.current).toEqual({ products: [{ id: 'p1' }], total: 3 }),
      );
      expect(fetchProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          imageless: true,
          staffToken: 'token',
          locale: 'en',
          limit: 10,
        }),
      );
      expect(fetchProductsCount).toHaveBeenCalledWith({
        imageless: true,
        staffToken: 'token',
      });
    },
  );

  it('does not refetch when the token is silently refreshed', async () => {
    signIn('ADMIN', 'token');
    const { result, rerender } = renderHook(() => useImagelessProducts('en'));
    await waitFor(() => expect(result.current).not.toBeNull());

    signIn('ADMIN', 'refreshed-token');
    rerender();
    expect(fetchProducts).toHaveBeenCalledTimes(1);
  });
});
