// @vitest-environment jsdom

import CartProductCard from '@/pages/cart/components/ProductCard';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import type { Product } from '@prisma/client';
import { screen, waitFor } from '@testing-library/react';
import { createElement, Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/ProductContext', () => ({
  useProductContext: vi.fn(),
}));

vi.mock('@/pages/lib/NetworkContext', () => ({
  useNetworkContext: vi.fn(),
}));

vi.mock('@/pages/components/AddToCart', () => ({
  default: () => createElement('div', { 'data-testid': 'add-to-cart' }),
}));

vi.mock('@/pages/components/VariantBadge', () => ({
  default: ({ spec }: { spec?: string }) =>
    createElement('div', {
      'data-testid': 'variant-badge',
      'data-spec': spec ?? '',
    }),
}));

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    slug: 'test-product',
    name: '{"en":"Test Product","tk":"Test","ru":"Test","ch":"Test","tr":"Test"}',
    description: null,
    price: '5.00',
    cachedPrice: 5,
    imgUrls: [],
    tags: [],
    videoUrls: [],
    categoryId: 'cat-1',
    brandId: null,
    isOutOfStock: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as Product;
}

function renderCard(
  selectedVariant: string | null | undefined = null,
  product: Product = makeProduct(),
) {
  return renderWithProviders(
    createElement(
      Suspense,
      { fallback: null },
      createElement(CartProductCard, {
        product,
        selectedVariant,
        colorsMap: new Map(),
        cartProps: { cartAction: 'detail', cartItemId: 'ci-1', quantity: 1 },
      }),
    ),
  );
}

describe('CartProductCard — variant badge', () => {
  beforeEach(() => {
    vi.mocked(useProductContext).mockReturnValue({
      setSelectedProduct: vi.fn(),
    } as never);

    vi.mocked(useNetworkContext).mockReturnValue({
      network: 'fast',
      setNetwork: vi.fn(),
    } as never);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: { name: '{"en":"Test Category"}' },
      }),
    } as never);
  });

  it('renders VariantBadge when selectedVariant is a non-empty string', async () => {
    renderCard('128gb storage [price-1]{color-1}');

    await waitFor(() => {
      expect(screen.getByTestId('variant-badge')).toBeInTheDocument();
    });
  });

  it('does not render VariantBadge when selectedVariant is null', async () => {
    renderCard(null);

    await waitFor(() => {
      expect(screen.queryByTestId('variant-badge')).not.toBeInTheDocument();
    });
  });

  it('does not render VariantBadge when selectedVariant is undefined', async () => {
    renderCard(undefined);

    await waitFor(() => {
      expect(screen.queryByTestId('variant-badge')).not.toBeInTheDocument();
    });
  });
});
