// @vitest-environment jsdom

import ProductGridContent from '@/pages/components/ProductGridContent';
import PrevProductContextProvider from '@/pages/lib/PrevProductContext';
import ProductContextProvider from '@/pages/lib/ProductContext';
import { Product } from '@prisma/client';
import { act, screen } from '@testing-library/react';
import mockRouter from 'next-router-mock';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

const nothing = vi.hoisted(() => (): null => null);
const apis = vi.hoisted(() => ({
  fetchProducts: vi.fn(),
  fetchProductsCount: vi.fn(),
  fetchCategoryFacets: vi.fn(),
  fetchProductFilterOptions: vi.fn(),
  fetchColors: vi.fn(async (): Promise<never[]> => []),
}));
vi.mock('@/pages/lib/apis', () => apis);

vi.mock('@/pages/lib/PlatformContext', async () => ({
  ...(await vi.importActual<typeof import('@/pages/lib/PlatformContext')>(
    '@/pages/lib/PlatformContext',
  )),
  usePlatform: () => 'web',
}));
vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: () => ({ user: null as null }),
}));
vi.mock('@/pages/lib/CategoryContext', () => ({
  useCategoryContext: () => ({
    categories: [] as never[],
    setSelectedCategoryId: vi.fn(),
  }),
}));
vi.mock('@/pages/lib/hooks/useLoadMoreSentinel', () => ({
  useLoadMoreSentinel: vi.fn(),
}));

vi.mock('@/pages/components/Layout', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/pages/components/ProductCard', () => ({
  default: ({ product }: { product?: { name: string } }) =>
    product ? createElement('div', null, product.name) : null,
}));
vi.mock('@/pages/components/AddEditProductDialog', () => ({
  default: nothing,
}));
vi.mock('@/pages/components/SimpleBreadcrumbs', () => ({ default: nothing }));
vi.mock('@/pages/components/FilterSidebar', () => ({ default: nothing }));
vi.mock('@/pages/components/FilterSheet', () => ({ default: nothing }));
vi.mock('@/pages/components/ActiveFilterChips', () => ({ default: nothing }));
vi.mock('@/pages/components/SortDropdown', () => ({ default: nothing }));
vi.mock('@/pages/components/Appbar', () => ({ SearchBar: nothing }));

const seeded = [{ id: 'p1', name: 'Seeded Phone' } as Product];

function renderGrid() {
  return renderWithProviders(
    createElement(
      ProductContextProvider,
      null,
      createElement(
        PrevProductContextProvider,
        null,
        createElement(ProductGridContent, {
          landingCategoryId: 'phones',
          initialProducts: seeded,
        }),
      ),
    ),
  );
}

describe('ProductGridContent with a seeded first page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apis.fetchProductsCount.mockResolvedValue(0);
    apis.fetchCategoryFacets.mockResolvedValue([]);
    apis.fetchProductFilterOptions.mockResolvedValue({
      total: 0,
      relaxations: { brands: 5 },
      colors: [],
      brandCounts: {},
      colorCounts: {},
      price: null,
    });
  });

  it('shows the seeded products until the first query answers', async () => {
    mockRouter.setCurrentUrl('/category/phones');
    apis.fetchProducts.mockReturnValue(new Promise(() => {}));

    renderGrid();
    await act(async () => {});

    expect(screen.getByText('Seeded Phone')).toBeInTheDocument();
  });

  // Reported bug: a price filter matching nothing still listed the seeded,
  // unfiltered phones, because an empty answer fell back to the seed.
  it('shows an empty result as empty, not as the unfiltered seed', async () => {
    mockRouter.setCurrentUrl(
      '/category/phones?minPrice=50000&maxPrice=50001&brandIds=b1',
    );
    apis.fetchProducts.mockResolvedValue([]);

    renderGrid();

    expect(await screen.findByText('No Products Found!')).toBeInTheDocument();
    expect(screen.queryByText('Seeded Phone')).not.toBeInTheDocument();
    expect(
      await screen.findByText('Without “Brands”: 5 products'),
    ).toBeInTheDocument();
  });
});
