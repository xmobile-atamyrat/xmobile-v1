// @vitest-environment jsdom

import { useFetchWithCreds } from '@/pages/lib/fetch';
import Product from '@/pages/product/[slug].page';
import type { Product as PrismaProduct } from '@prisma/client';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('next/router', () => ({
  useRouter: () => ({ locale: 'en', back: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: () => ({ accessToken: '' }),
}));

vi.mock('@/pages/lib/NetworkContext', () => ({
  useNetworkContext: () => ({ network: 'fast' }),
}));

vi.mock('@/pages/lib/PrevProductContext', () => ({
  usePrevProductContext: () => ({}),
}));

vi.mock('@/pages/lib/ProductContext', () => ({
  useProductContext: () => ({ setProducts: vi.fn() }),
}));

// One object for every render: the page has an effect on `categories`, so a
// fresh array each time would re-render it forever.
vi.mock('@/pages/lib/CategoryContext', () => {
  const context = { categories: [] as never[] };
  return { useCategoryContext: () => context };
});

vi.mock('@/pages/lib/fetch', () => ({
  useFetchWithCreds: vi.fn(),
}));

vi.mock('@/pages/lib/apis', () => ({
  fetchColors: vi.fn(async () => []),
  fetchProducts: vi.fn(),
  fetchAllProductSlugs: vi.fn(),
}));

vi.mock('@/pages/components/Layout', () => ({
  default: ({ children }: { children: ReactNode }) =>
    createElement('div', null, children),
}));

vi.mock('@/pages/components/SimpleBreadcrumbs', () => ({
  default: (): null => null,
}));

vi.mock('@/pages/components/FavoriteButton', () => ({
  default: (): null => null,
}));

vi.mock('@/pages/components/AddEditProductDialog', () => ({
  default: (): null => null,
}));

vi.mock('@/pages/components/AddToCart', () => ({
  default: ({ selectedVariant }: { selectedVariant?: string }) =>
    createElement('div', {
      'data-testid': 'add-to-cart',
      'data-variant': selectedVariant,
    }),
}));

const row = (id: string, tmt: string, salePriceTmt?: string) => ({
  id,
  priceInTmt: tmt,
  displayPriceTmt: tmt,
  salePriceTmt,
  outOfStockAt: null as Date | null,
});

const rows: Record<string, ReturnType<typeof row>> = {
  p1: row('p1', '1000'),
  p2: row('p2', '2000', '1500'),
};

const makeProduct = (id = 'prod-1') =>
  ({
    id,
    slug: id,
    name: 'Phone',
    description: null,
    price: '[p1]{1000}',
    imgUrls: [],
    tags: ['64gb [p1]', '128gb [p2]'],
    videoUrls: [],
    categoryId: null,
    outOfStockAt: null,
    sale: { bestPercent: 25, base: null },
  }) as unknown as PrismaProduct;

const selected = () =>
  screen.getByTestId('add-to-cart').getAttribute('data-variant');

describe('product page with a variant on sale', () => {
  beforeEach(() => {
    vi.mocked(useFetchWithCreds).mockReturnValue((async ({
      path,
    }: {
      path: string;
    }) => ({
      success: true,
      data: rows[path.split('id=')[1]],
    })) as never);
  });

  it('opens on the discounted variant and shows both prices', async () => {
    renderWithProviders(
      createElement(Product, { product: makeProduct() } as never),
    );

    const oldPrice = await screen.findByText('2000');
    expect(oldPrice.tagName).toBe('DEL');
    expect(screen.getByText('1500')).toBeInTheDocument();
    // One on the price, one on the spec option.
    expect(screen.getAllByText('-25%')).toHaveLength(2);
    await waitFor(() => expect(selected()).toBe('128gb [p2]'));
  });

  it('drops the crossed price when a full-price spec is picked', async () => {
    renderWithProviders(
      createElement(Product, { product: makeProduct() } as never),
    );
    await screen.findByText('2000');

    fireEvent.click(screen.getByText('64gb'));

    expect(screen.queryByText('2000')).not.toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getAllByText('-25%')).toHaveLength(1);
    expect(selected()).toBe('64gb [p1]');
  });

  it("keeps the shopper's pick on a reload, not on another product", async () => {
    const view = renderWithProviders(
      createElement(Product, { product: makeProduct() } as never),
    );
    await screen.findByText('2000');
    fireEvent.click(screen.getByText('64gb'));

    view.rerender(createElement(Product, { product: makeProduct() } as never));
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    expect(selected()).toBe('64gb [p1]');

    view.rerender(
      createElement(Product, { product: makeProduct('prod-2') } as never),
    );
    await waitFor(() => expect(selected()).toBe('128gb [p2]'));
  });
});
