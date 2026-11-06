// @vitest-environment jsdom

import { useFavoritesContext } from '@/pages/lib/FavoritesContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import FavoritesPage, { getStaticProps } from '@/pages/favorites/index.page';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import mockRouter from 'next-router-mock';
import { createElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { endAnimation } from './helpers/endAnimation';
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
  default: ({
    product,
    onFavoriteRemove,
  }: {
    product: { name: string };
    onFavoriteRemove?: () => void;
  }) =>
    createElement(
      'div',
      { 'data-testid': 'card', onClick: onFavoriteRemove },
      product.name,
    ),
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
    addFavorites: vi.fn(),
  });
}

const renderPage = () => renderWithProviders(createElement(FavoritesPage));

async function renderPageWithRealContext(initialFavoriteIds?: string[]) {
  const actual = await vi.importActual<
    typeof import('@/pages/lib/FavoritesContext')
  >('@/pages/lib/FavoritesContext');
  vi.mocked(useUserContext).mockReturnValue({
    user: { id: 'u1' },
    accessToken: 'token',
    isLoading: false,
    initialFavoriteIds,
  } as never);
  vi.mocked(useFavoritesContext).mockImplementation(actual.useFavoritesContext);
  return renderWithProviders(
    createElement(actual.default, null, createElement(FavoritesPage)),
  );
}

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

  it('keeps the page out of search results', async () => {
    const { props } = (await getStaticProps({ locale: 'en' })) as {
      props: { seoData?: { noIndex: boolean; canonicalUrl: string } };
    };

    expect(props.seoData?.noIndex).toBe(true);
    expect(props.seoData?.canonicalUrl).toMatch(/\/en\/favorites$/);
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

  describe('removing a card', () => {
    // Clicking the mocked card stands in for its heart: the context drops the
    // id, and the button reports the removal.
    async function removePhone(favorites: string[]) {
      setUp({ favorites });
      renderPage();
      const card = await screen.findByText('Phone');
      favorites.splice(favorites.indexOf('p1'), 1);
      fireEvent.click(card);
      return card;
    }

    it('keeps the card on screen while it shrinks away', async () => {
      const card = await removePhone(['p1', 'p2']);

      expect(card).toBeInTheDocument();
      expect(card.parentElement?.className).toContain(
        'animate-favorite-card-leave',
      );
    });

    it('drops the card when its exit ends', async () => {
      const card = await removePhone(['p1', 'p2']);

      endAnimation(card.parentElement as Element);

      expect(screen.queryByText('Phone')).not.toBeInTheDocument();
      expect(screen.getByText('Tablet')).toBeInTheDocument();
    });

    it('ignores animations ending inside the card', async () => {
      const card = await removePhone(['p1', 'p2']);

      endAnimation(card);

      expect(screen.getByText('Phone')).toBeInTheDocument();
    });

    it('holds the empty notice until the last card has left', async () => {
      fetchWithCreds.mockResolvedValue({ success: true, data: [phone] });
      const card = await removePhone(['p1']);

      expect(
        screen.queryByText('You have no favorites yet'),
      ).not.toBeInTheDocument();

      endAnimation(card.parentElement as Element);

      expect(screen.getByText('You have no favorites yet')).toBeInTheDocument();
    });

    it('keeps the card when the save fails during its exit', async () => {
      const favorites = ['p1', 'p2'];
      const card = await removePhone(favorites);
      favorites.push('p1');

      endAnimation(card.parentElement as Element);

      expect(screen.getByText('Phone')).toBeInTheDocument();
    });
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

  it('still lists the favorites when the ids request fails', async () => {
    fetchWithCreds.mockImplementation(async ({ path }: { path: string }) => {
      if (path.includes('ids=1')) throw new Error('offline');
      return { success: true, data: [phone, tablet] };
    });

    await renderPageWithRealContext();

    expect(await screen.findAllByTestId('card')).toHaveLength(2);
    expect(
      screen.queryByText('You have no favorites yet'),
    ).not.toBeInTheDocument();
  });

  it("shows a favorite the session's ids do not have yet", async () => {
    await renderPageWithRealContext(['p1']);

    expect(await screen.findAllByTestId('card')).toHaveLength(2);
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
