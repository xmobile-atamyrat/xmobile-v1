// @vitest-environment jsdom

import FavoritesContextProvider, {
  useFavoritesContext,
} from '@/pages/lib/FavoritesContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: vi.fn(),
}));

vi.mock('@/pages/lib/fetch', () => ({
  useFetchWithCreds: vi.fn(),
}));

const fetchWithCreds = vi.fn();

const guest = { isLoading: false };
const signedIn = (id: string, initialFavoriteIds?: string[]) => ({
  user: { id },
  accessToken: `token-${id}`,
  isLoading: false,
  initialFavoriteIds,
});

function setSession(session: object) {
  vi.mocked(useUserContext).mockReturnValue(session as never);
}

function renderFavorites() {
  return renderHook(() => useFavoritesContext(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(FavoritesContextProvider, null, children),
  });
}

describe('FavoritesContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchWithCreds.mockReset();
    fetchWithCreds.mockResolvedValue({ success: true, data: [] });
    vi.mocked(useFetchWithCreds).mockReturnValue(fetchWithCreds as never);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('uses the ids from the session without a request', () => {
    setSession(signedIn('u1', ['p1']));

    const { result } = renderFavorites();

    expect(result.current.isFavorite('p1')).toBe(true);
    expect(fetchWithCreds).not.toHaveBeenCalled();
  });

  // A context change while a next/dynamic boundary is still hydrating throws
  // "This Suspense boundary received an update before it finished hydrating".
  it('leaves the context alone when a guest loads a page', () => {
    setSession(guest);
    let renders = 0;

    renderHook(
      () => {
        renders += 1;
        return useFavoritesContext();
      },
      {
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(FavoritesContextProvider, null, children),
      },
    );

    expect(renders).toBe(1);
  });

  it('waits for the session to load before fetching', () => {
    setSession({ ...guest, isLoading: true });

    renderFavorites();

    expect(fetchWithCreds).not.toHaveBeenCalled();
  });

  it('fetches the ids after a sign-in, which returns none', async () => {
    setSession(guest);
    fetchWithCreds.mockResolvedValue({ success: true, data: ['p2'] });
    const { result, rerender } = renderFavorites();

    setSession(signedIn('u1'));
    rerender();

    await waitFor(() => expect(result.current.isFavorite('p2')).toBe(true));
    expect(fetchWithCreds).toHaveBeenCalledWith({
      accessToken: 'token-u1',
      path: '/api/favorites?ids=1',
      method: 'GET',
    });
  });

  it('clears the favorites on sign-out', () => {
    setSession(signedIn('u1', ['p1']));
    const { result, rerender } = renderFavorites();

    setSession(guest);
    rerender();

    expect(result.current.isFavorite('p1')).toBe(false);
  });

  it("does not give the next user the first session's ids", async () => {
    setSession(signedIn('u1', ['p1']));
    fetchWithCreds.mockResolvedValue({ success: true, data: ['p9'] });
    const { result, rerender } = renderFavorites();

    setSession({ ...guest, initialFavoriteIds: ['p1'] });
    rerender();
    setSession(signedIn('u2', ['p1']));
    rerender();

    await waitFor(() => expect(result.current.isFavorite('p9')).toBe(true));
    expect(result.current.isFavorite('p1')).toBe(false);
  });

  it('ignores ids that arrive after the user signed out', async () => {
    setSession(guest);
    let resolveIds: (value: object) => void = () => undefined;
    fetchWithCreds.mockReturnValue(
      new Promise((resolve) => {
        resolveIds = resolve;
      }),
    );
    const { result, rerender } = renderFavorites();
    setSession(signedIn('u1'));
    rerender();

    setSession(guest);
    rerender();
    await act(async () => resolveIds({ success: true, data: ['p1'] }));

    expect(result.current.isFavorite('p1')).toBe(false);
  });

  it('marks a product before the server answers, then saves it', async () => {
    setSession(signedIn('u1', []));
    let finish: (value: object) => void = () => undefined;
    fetchWithCreds.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderFavorites();

    act(() => {
      result.current.toggleFavorite('p1');
    });

    expect(result.current.isFavorite('p1')).toBe(true);
    expect(fetchWithCreds).toHaveBeenCalledWith({
      accessToken: 'token-u1',
      path: '/api/favorites',
      method: 'POST',
      body: { productId: 'p1' },
    });
    await act(async () => finish({ success: true }));
    expect(result.current.isFavorite('p1')).toBe(true);
  });

  it('removes a favorite with DELETE', async () => {
    setSession(signedIn('u1', ['p1']));
    const { result } = renderFavorites();

    await act(() => result.current.toggleFavorite('p1'));

    expect(result.current.isFavorite('p1')).toBe(false);
    expect(fetchWithCreds).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'DELETE',
        body: { productId: 'p1' },
      }),
    );
  });

  it('reverts when the server refuses', async () => {
    setSession(signedIn('u1', []));
    fetchWithCreds.mockResolvedValue({ success: false, message: 'no' });
    const { result } = renderFavorites();

    await act(() => result.current.toggleFavorite('p1'));

    expect(result.current.isFavorite('p1')).toBe(false);
  });

  it('reverts when the network fails', async () => {
    setSession(signedIn('u1', ['p1']));
    fetchWithCreds.mockRejectedValue(new Error('offline'));
    const { result } = renderFavorites();

    await act(() => result.current.toggleFavorite('p1'));

    expect(result.current.isFavorite('p1')).toBe(true);
  });

  it('ignores a second tap while the first is still saving', async () => {
    setSession(signedIn('u1', []));
    let finish: (value: object) => void = () => undefined;
    fetchWithCreds.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderFavorites();

    act(() => {
      result.current.toggleFavorite('p1');
      result.current.toggleFavorite('p1');
    });
    await act(async () => finish({ success: true }));

    expect(fetchWithCreds).toHaveBeenCalledTimes(1);
    expect(result.current.isFavorite('p1')).toBe(true);
  });

  it('can toggle again once the save has finished', async () => {
    setSession(signedIn('u1', []));
    const { result } = renderFavorites();

    await act(() => result.current.toggleFavorite('p1'));
    await act(() => result.current.toggleFavorite('p1'));

    expect(fetchWithCreds).toHaveBeenCalledTimes(2);
    expect(result.current.isFavorite('p1')).toBe(false);
  });
});
