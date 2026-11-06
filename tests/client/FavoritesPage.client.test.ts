// @vitest-environment jsdom

import { useFavoritesContext } from '@/pages/lib/FavoritesContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import FavoritesPage from '@/pages/favorites/index.page';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import mockRouter from 'next-router-mock';
import { createElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: vi.fn(),
}));

vi.mock('@/pages/lib/FavoritesContext', () => ({
  useFavoritesContext: vi.fn(),
}));

vi.mock('@/pages/lib/fetch', () => ({
  useFetchWithCreds: vi.fn(),
}));

vi.mock('@/pages/components/Layout', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/pages/user/components/AccountNav', () => ({
  default: (): null => null,
}));

vi.mock('@/pages/components/ProductCard', () => ({
  default: ({ product }: { product: { name: string } }) =>
    createElement('div', { 'data-testid': 'card' }, product.name),
}));

const fetchWithCreds = vi.fn();
const phone = { id: 'p1', name: 'Phone' };
const tablet = { id: 'p2', name: 'Tablet' };

function setUp({
  user = { id: 'u1' },
  isLoading = false,
  favorites = ['p1', 'p2'],
}: {
  user?: { id: string } | null;
  isLoading?: boolean;
  favorites?: string[];
} = {}) {
  vi.mocked(useUserContext).mockReturnValue({
    user: user ?? undefined,
    accessToken: 'token',
    isLoading,
  } as never);
  vi.mocked(useFavoritesContext).mockReturnValue({
    isFavorite: (id: string) => favorites.includes(id),
    toggleFavorite: vi.fn(),
  });
}

const renderPage = () => renderWithProviders(createElement(FavoritesPage));

describe('Favorites page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchWithCreds.mockReset();
    fetchWithCreds.mockResolvedValue({
      success: true,
      data: [phone, tablet],
    });
    vi.mocked(useFetchWithCreds).mockReturnValue(fetchWithCreds as never);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRouter.setCurrentUrl('/favorites');
    mockRouter.locale = 'en';
  });

  it('lists the favorites in the active language', async () => {
    setUp();

    renderPage();

    expect(await screen.findAllByTestId('card')).toHaveLength(2);
    expect(fetchWithCreds).toHaveBeenCalledWith({
      accessToken: 'token',
      path: '/api/favorites?locale=en',
      method: 'GET',
    });
  });

  it('drops a card as soon as its heart is removed', async () => {
    setUp({ favorites: ['p2'] });

    renderPage();

    expect(await screen.findByText('Tablet')).toBeInTheDocument();
    expect(screen.queryByText('Phone')).not.toBeInTheDocument();
  });

  it('says so when there are no favorites', async () => {
    setUp({ favorites: [] });
    fetchWithCreds.mockResolvedValue({ success: true, data: [] });

    renderPage();

    expect(
      await screen.findByText('You have no favorites yet'),
    ).toBeInTheDocument();
  });

  it('sends an empty list back to the products', async () => {
    setUp({ favorites: [] });
    fetchWithCreds.mockResolvedValue({ success: true, data: [] });
    renderPage();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Start Shopping' }),
    );

    expect(mockRouter.asPath).toBe('/product');
  });

  it('asks a guest to sign in, without calling the API', async () => {
    setUp({ user: null });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      screen.getByText('Sign in to see your favorites'),
    ).toBeInTheDocument();
    expect(mockRouter.asPath).toBe('/user/signin');
    expect(fetchWithCreds).not.toHaveBeenCalled();
  });

  it('does not show the guest prompt while the session loads', () => {
    setUp({ user: null, isLoading: true });

    renderPage();

    expect(
      screen.queryByText('Sign in to see your favorites'),
    ).not.toBeInTheDocument();
  });

  it('reports a failed load rather than an empty list', async () => {
    setUp();
    fetchWithCreds.mockRejectedValue(new Error('offline'));

    renderPage();

    expect(
      await screen.findByText("Couldn't load your favorites"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('You have no favorites yet'),
    ).not.toBeInTheDocument();
  });

  it('reports a refused request the same way', async () => {
    setUp();
    fetchWithCreds.mockResolvedValue({ success: false, message: 'no' });

    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText("Couldn't load your favorites"),
      ).toBeInTheDocument(),
    );
  });
});
