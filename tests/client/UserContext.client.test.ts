// @vitest-environment jsdom

import { AUTH_REFRESH_COOKIE_NAME } from '@/pages/lib/constants';
import UserContextProvider, { useUserContext } from '@/pages/lib/UserContext';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/lib/hooks/useWebViewSync', () => ({
  useWebViewSync: vi.fn(),
}));

describe('UserContext', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = `${AUTH_REFRESH_COOKIE_NAME}=; Max-Age=0; Path=/`;
  });

  it('exposes the favorite ids that came with the session', async () => {
    document.cookie = `${AUTH_REFRESH_COOKIE_NAME}=refresh; Path=/`;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          data: {
            accessToken: 'token',
            user: { id: 'u1' },
            cartCount: 0,
            favoriteProductIds: ['p1'],
          },
        }),
      }),
    );

    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(UserContextProvider, null, children),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.initialFavoriteIds).toEqual(['p1']);
  });
});
