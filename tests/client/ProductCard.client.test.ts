// @vitest-environment jsdom

import ProductCard from '@/pages/components/ProductCard';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { computeProductPrice } from '@/pages/product/utils';
import type { Product } from '@prisma/client';
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

vi.mock('@/pages/lib/fetch', () => ({
  useFetchWithCreds: vi.fn(),
}));

vi.mock('@/pages/product/utils', () => ({
  computeProductPrice: vi.fn(),
}));

vi.mock('@/pages/components/AddToCart', () => ({
  default: () => createElement('div', { 'data-testid': 'add-to-cart' }),
}));

function makeProduct(overrides: Partial<Product> = {}): Product {
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
    isOutOfStock: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ProductCard', () => {
  beforeEach(() => {
    vi.mocked(useProductContext).mockReturnValue({
      setSelectedProduct: vi.fn(),
    } as never);

    vi.mocked(useUserContext).mockReturnValue({
      accessToken: 'token',
    } as never);

    vi.mocked(useNetworkContext).mockReturnValue({
      network: 'fast',
      setNetwork: vi.fn(),
    });

    vi.mocked(useFetchWithCreds).mockReturnValue(vi.fn() as never);

    vi.mocked(computeProductPrice).mockImplementation(
      async ({ product }) => product,
    );
  });

  function renderCard(
    product: Product,
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

  it('shows out-of-stock overlay when isOutOfStock is true', async () => {
    renderCard(makeProduct({ isOutOfStock: true }));

    await waitFor(() => {
      expect(screen.getByText('Out of stock')).toBeInTheDocument();
    });
  });

  it('does not show out-of-stock overlay when isOutOfStock is false', async () => {
    renderCard(makeProduct({ isOutOfStock: false }));

    await waitFor(() => {
      expect(screen.queryByText('Out of stock')).not.toBeInTheDocument();
    });
  });

  it('hides the cart delete button when isOutOfStock is true', async () => {
    renderCard(makeProduct({ isOutOfStock: true }), 'delete');

    await waitFor(() => {
      expect(screen.queryByTestId('add-to-cart')).not.toBeInTheDocument();
    });
  });

  it('renders the cart delete button when isOutOfStock is false', async () => {
    renderCard(makeProduct({ isOutOfStock: false }), 'delete');

    await waitFor(() => {
      expect(screen.getByTestId('add-to-cart')).toBeInTheDocument();
    });
  });
});
