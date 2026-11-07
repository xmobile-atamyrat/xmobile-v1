// @vitest-environment jsdom

import { useFavoritesContext } from '@/pages/lib/FavoritesContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import FavoritesPage, { getStaticProps } from '@/pages/favorites/index.page';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import mockRouter from 'next-router-mock';
import { createElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/pages/lib/apis', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/pages/lib/apis')>()),
  fetchBrands: async () => [
    { id: 'b1', name: 'Apple', productCount: 1 },
    { id: 'b2', name: 'Samsung', productCount: 1 },
    { id: 'b3', name: 'Xiaomi', productCount: 0 },
  ],
  fetchColors: async (): Promise<never[]> => [],
  fetchProductFilterOptions: async () => ({ colors: [] as string[] }),
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
const phone = {
  id: 'p1',
  name: 'Phone',
  brandId: 'b1',
  cachedPrice: 300,
  outOfStockAt: null as string | null,
  colors: [] as { id: string }[],
};
const tablet = { ...phone, id: 'p2', name: 'Tablet', brandId: 'b2' };

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

const cardNames = () =>
  screen.getAllByTestId('card').map((card) => card.textContent);

// The rail rebuilds its rows as each reference list arrives, so a checkbox found
// too early is gone by the time it is clicked.
async function settleRail(name: string) {
  await screen.findByRole('checkbox', { name });
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve);
    });
  });
}

async function tick(name: string) {
  await settleRail(name);
  fireEvent.click(screen.getByRole('checkbox', { name }));
}

function setMobile(mobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: mobile,
      media: query,
      onchange: null as never,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

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

  describe('filters and sort', () => {
    const cheapTablet = { ...tablet, cachedPrice: 100 };

    beforeEach(() => {
      fetchWithCreds.mockResolvedValue({
        success: true,
        data: [phone, cheapTablet],
      });
    });

    it('narrows the list to a ticked brand', async () => {
      setUp();
      renderPage();

      await tick('Apple');

      await waitFor(() => expect(cardNames()).toEqual(['Phone']));
    });

    it('filters without asking the server again', async () => {
      setUp();
      renderPage();

      await tick('Apple');

      await waitFor(() => expect(cardNames()).toEqual(['Phone']));
      expect(fetchWithCreds).toHaveBeenCalledTimes(1);
    });

    it('keeps the chosen filter in the URL', async () => {
      setUp();
      renderPage();

      await tick('Apple');

      await waitFor(() => expect(mockRouter.query.brandIds).toEqual(['b1']));
      expect(mockRouter.pathname).toBe('/favorites');
    });

    it('applies the filters in a link', async () => {
      mockRouter.setCurrentUrl('/favorites?brandIds=b2');
      setUp();

      renderPage();

      await screen.findByText('Tablet');
      expect(cardNames()).toEqual(['Tablet']);
    });

    it('reorders the list from the sort dropdown', async () => {
      setUp();
      renderPage();
      await screen.findByText('Phone');

      fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Sort by' }));
      fireEvent.click(
        await screen.findByRole('option', { name: 'Price Low-to-High' }),
      );

      await waitFor(() => expect(cardNames()).toEqual(['Tablet', 'Phone']));
    });

    it('shows a chip that takes its filter off again', async () => {
      mockRouter.setCurrentUrl('/favorites?brandIds=b2');
      setUp();
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Samsung' }));

      await waitFor(() => expect(cardNames()).toEqual(['Phone', 'Tablet']));
    });

    it('tells a filter with no matches apart from an empty list', async () => {
      mockRouter.setCurrentUrl('/favorites?brandIds=b3');
      setUp();

      renderPage();

      expect(await screen.findByText('No Products Found!')).toBeInTheDocument();
      expect(
        screen.queryByText('You have no favorites yet'),
      ).not.toBeInTheDocument();
    });

    it('leaves the rail up so a filter with no matches can be undone', async () => {
      mockRouter.setCurrentUrl('/favorites?brandIds=b3');
      setUp();

      renderPage();

      expect(
        await screen.findByRole('checkbox', { name: 'Xiaomi' }),
      ).toBeChecked();
    });

    it('keeps a removed card shrinking while filters are on', async () => {
      mockRouter.setCurrentUrl('/favorites?brandIds=b1');
      const favorites = ['p1', 'p2'];
      setUp({ favorites });
      renderPage();
      const card = await screen.findByText('Phone');

      favorites.splice(0, 1);
      fireEvent.click(card);

      expect(card.parentElement?.className).toContain(
        'animate-favorite-card-leave',
      );
    });

    it('offers no filters with nothing to filter', async () => {
      setUp({ favorites: [] });
      fetchWithCreds.mockResolvedValue({ success: true, data: [] });

      renderPage();

      await screen.findByText('You have no favorites yet');
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.queryByText('Filters')).not.toBeInTheDocument();
    });

    it('offers no filters to a guest', () => {
      setUp({ user: null });

      renderPage();

      expect(screen.queryByText('Filters')).not.toBeInTheDocument();
    });

    it('offers no filters when the list failed to load', async () => {
      setUp();
      fetchWithCreds.mockRejectedValue(new Error('offline'));

      renderPage();

      await screen.findByText("Couldn't load your favorites");
      expect(screen.queryByText('Filters')).not.toBeInTheDocument();
    });

    describe('on mobile', () => {
      beforeEach(() => setMobile(true));
      afterEach(() => setMobile(false));

      const openSheet = async () => {
        setUp();
        renderPage();
        fireEvent.click(await screen.findByRole('button', { name: 'Filters' }));
        await settleRail('Apple');
      };

      it('keeps the rail in the sheet, off the page', async () => {
        setUp();

        renderPage();

        await screen.findByRole('button', { name: 'Filters' });
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      });

      it('waits for Apply before filtering', async () => {
        await openSheet();

        await tick('Apple');

        expect(screen.getByRole('checkbox', { name: 'Apple' })).toBeChecked();
        expect(cardNames()).toEqual(['Phone', 'Tablet']);
      });

      it('filters the list on Apply', async () => {
        await openSheet();
        await tick('Apple');

        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        await waitFor(() => expect(cardNames()).toEqual(['Phone']));
      });

      it('offers the sort options in the sheet', async () => {
        await openSheet();

        fireEvent.click(screen.getByText('Price Low-to-High'));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        await waitFor(() => expect(cardNames()).toEqual(['Tablet', 'Phone']));
      });
    });
  });
});
