// @vitest-environment jsdom

import ProductCard from '@/pages/components/ProductCard';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useStalePrices } from '@/pages/lib/StalePricesContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { computeProductPrice } from '@/pages/product/utils';
import type { ExtendedProduct } from '@/pages/lib/types';
import { screen, waitFor } from '@testing-library/react';
import { createElement, Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/ProductContext', () => ({
  useProductContext: vi.fn(),
}));

vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: vi.fn(),
}));

vi.mock('@/pages/lib/NetworkContext', () => ({
  useNetworkContext: vi.fn(),
}));

vi.mock('@/pages/lib/StalePricesContext', () => ({
  useStalePrices: vi.fn(),
}));

vi.mock('@/pages/lib/fetch', () => ({
  useFetchWithCreds: vi.fn(),
}));

// Only the price lookup is faked; tag parsing stays real.
vi.mock('@/pages/product/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/pages/product/utils')>()),
  computeProductPrice: vi.fn(),
}));

vi.mock('@/pages/components/AddToCart', () => ({
  default: ({ selectedVariant }: { selectedVariant?: string }) =>
    createElement('div', {
      'data-testid': 'add-to-cart',
      'data-variant': selectedVariant,
    }),
}));

function makeProduct(
  overrides: Partial<ExtendedProduct> = {},
): ExtendedProduct {
  return {
    id: 'prod-1',
    slug: 'test-product',
    name: '{"en":"Test Product","tk":"Test","ru":"Test","ch":"Test"}',
    description: null,
    price: '5.00',
    cachedPrice: 5,
    imgUrls: ['https://example.com/img.jpg'],
    tags: [],
    videoUrls: [],
    categoryId: 'cat-1',
    brandId: null,
    outOfStockAt: null,
    recommendedOrder: null,
    listingRank: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ProductCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useProductContext).mockReturnValue({
      setSelectedProduct: vi.fn(),
      colorsMap: new Map(),
    } as never);

    vi.mocked(useUserContext).mockReturnValue({
      accessToken: 'token',
    } as never);

    vi.mocked(useNetworkContext).mockReturnValue({
      network: 'fast',
      setNetwork: vi.fn(),
    });

    vi.mocked(useFetchWithCreds).mockReturnValue(vi.fn() as never);

    vi.mocked(useStalePrices).mockReturnValue({
      staleByProductId: {},
      staleCount: 0,
      refresh: vi.fn(),
    });

    vi.mocked(computeProductPrice).mockImplementation(
      async ({ product }) => product,
    );
  });

  function renderCard(
    product: ExtendedProduct,
    cartAction: 'add' | 'delete' | 'detail' = 'add',
  ) {
    return renderWithProviders(
      createElement(
        Suspense,
        { fallback: null },
        createElement(ProductCard, {
          product,
          cartProps: { cartAction, cartItemId: 'ci-1', quantity: 1 },
        }),
      ),
    );
  }

  it('offers the heart on a grid card, outside the card links', async () => {
    renderCard(makeProduct());

    const heart = await screen.findByRole('button', {
      name: 'Add to favorites',
    });

    expect(heart.closest('a')).toBeNull();
  });

  it('leaves the heart off a cart line', async () => {
    renderCard(makeProduct(), 'delete');

    await screen.findByText('5.00', { exact: false });

    expect(
      screen.queryByRole('button', { name: 'Add to favorites' }),
    ).not.toBeInTheDocument();
  });

  it('shows out-of-stock overlay when out of stock', async () => {
    renderCard(makeProduct({ outOfStockAt: new Date() }));

    await waitFor(() => {
      expect(screen.getByText('Out of stock')).toBeInTheDocument();
    });
  });

  it('does not show out-of-stock overlay when in stock', async () => {
    renderCard(makeProduct({ outOfStockAt: null }));

    await waitFor(() => {
      expect(screen.queryByText('Out of stock')).not.toBeInTheDocument();
    });
  });

  it('hides the cart delete button when out of stock', async () => {
    renderCard(makeProduct({ outOfStockAt: new Date() }), 'delete');

    await waitFor(() => {
      expect(screen.queryByTestId('add-to-cart')).not.toBeInTheDocument();
    });
  });

  it('renders the cart delete button when in stock', async () => {
    renderCard(makeProduct({ outOfStockAt: null }), 'delete');

    await waitFor(() => {
      expect(screen.getByTestId('add-to-cart')).toBeInTheDocument();
    });
  });

  it('hides the price when out of stock', async () => {
    renderCard(makeProduct({ outOfStockAt: new Date(), price: '5.00' }));

    await waitFor(() => {
      expect(screen.getByText('Out of stock')).toBeInTheDocument();
    });
    expect(screen.queryByText(/5\.00/)).not.toBeInTheDocument();
  });

  it('does not look up the price of a sold-out product', async () => {
    renderCard(makeProduct({ outOfStockAt: new Date(), price: '[p1]' }));

    await waitFor(() => {
      expect(screen.getByText('Out of stock')).toBeInTheDocument();
    });
    expect(computeProductPrice).not.toHaveBeenCalled();
  });

  it('shows the price when in stock', async () => {
    renderCard(makeProduct({ outOfStockAt: null, price: '5.00' }));

    await waitFor(() => {
      expect(screen.getByText(/5\.00/)).toBeInTheDocument();
    });
  });

  const baseSale = {
    bestPercent: 20,
    base: { oldPrice: '1000', percent: 20 },
  };

  it('crosses out the old price when the base price is on sale', async () => {
    renderCard(makeProduct({ price: '800', sale: baseSale }));

    const oldPrice = await screen.findByText('1000');
    expect(oldPrice.tagName).toBe('DEL');
    expect(screen.getByText('800').closest('del')).toBeNull();
    expect(screen.getByText('-20%')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Another model/ })).toBeNull();
  });

  it('marks a sale on another model and leaves the price alone', async () => {
    renderCard(
      makeProduct({ price: '900', sale: { bestPercent: 15, base: null } }),
    );

    expect(
      await screen.findByRole('img', {
        name: 'Another model is on sale (-15%)',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/900/).closest('del')).toBeNull();
    expect(document.querySelector('del')).toBeNull();
  });

  it('keeps the other-model mark on a product without an image', async () => {
    renderCard(
      makeProduct({ imgUrls: [], sale: { bestPercent: 15, base: null } }),
    );

    expect(
      await screen.findByRole('img', { name: /Another model is on sale/ }),
    ).toBeInTheDocument();
  });

  it('says nothing about sales on a sold-out card', async () => {
    renderCard(makeProduct({ outOfStockAt: new Date(), sale: baseSale }));

    await screen.findByText('Out of stock');
    expect(screen.queryByText('-20%')).not.toBeInTheDocument();
    expect(screen.queryByText('1000')).not.toBeInTheDocument();
  });

  it('quick-adds the first variant when the base price is not on sale', async () => {
    renderCard(
      makeProduct({
        price: '[p2]{800}',
        tags: ['64gb [p1]', '128gb [p2]'],
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-to-cart')).toHaveAttribute(
        'data-variant',
        '64gb [p1]',
      );
    });
  });

  it('quick-adds the discounted base variant the card advertises', async () => {
    renderCard(
      makeProduct({
        price: '[p2]{800}',
        tags: ['64gb [p1]', '128gb [p2]'],
        sale: { bestPercent: 20, base: { oldPrice: '1000', percent: 20 } },
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-to-cart')).toHaveAttribute(
        'data-variant',
        '128gb [p2]',
      );
    });
  });

  it('offers no quick-add when no variant has the advertised sale price', async () => {
    renderCard(
      makeProduct({
        price: '[base]{800}',
        tags: ['64gb [p1]', '128gb [p2]'],
        sale: baseSale,
      }),
    );

    await screen.findByText('-20%');
    // The button is loaded lazily, so give it the chance to appear.
    await expect(screen.findByTestId('add-to-cart')).rejects.toThrow();
  });

  describe('stale price warning', () => {
    function withStale(tier: 'orange' | 'red', days: number) {
      vi.mocked(useStalePrices).mockReturnValue({
        staleByProductId: { 'prod-1': { tier, days } },
        staleCount: 1,
        refresh: vi.fn(),
      });
    }

    it('shows no badge when the product is not on the stale list', async () => {
      renderCard(makeProduct());

      await screen.findByText(/5\.00/);
      expect(screen.queryByTestId('stale-price-badge')).not.toBeInTheDocument();
    });

    it('shows the age and the tier hint on a stale card', async () => {
      withStale('red', 94);
      renderCard(makeProduct());

      const badge = await screen.findByTestId('stale-price-badge');
      expect(badge).toHaveTextContent('94 d');
      expect(badge).toHaveAccessibleName('Not updated for over 3 months: 94 d');
      expect(badge.className).toContain('bg-[#E5484D]');
    });

    it('uses the orange colours for the orange tier', async () => {
      withStale('orange', 40);
      renderCard(makeProduct());

      const badge = await screen.findByTestId('stale-price-badge');
      expect(badge.className).toContain('bg-[#F59E0B]');
    });

    it('leaves a sold-out card to its out-of-stock badge', async () => {
      withStale('red', 94);
      renderCard(makeProduct({ outOfStockAt: new Date() }));

      await screen.findByText('Out of stock');
      expect(screen.queryByTestId('stale-price-badge')).not.toBeInTheDocument();
    });
  });
});
