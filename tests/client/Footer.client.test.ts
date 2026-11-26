// @vitest-environment jsdom

import Footer from '@/pages/components/Footer';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useStalePrices } from '@/pages/lib/StalePricesContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { rootPopularCategory } from './helpers/categoryFixtures';
import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/CategoryContext', () => ({
  useCategoryContext: vi.fn(),
}));

vi.mock('@/pages/lib/ProductContext', () => ({
  useProductContext: vi.fn(),
}));

vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: vi.fn(),
}));

vi.mock('@/pages/lib/StalePricesContext', () => ({
  useStalePrices: vi.fn(),
}));

describe('Footer navigation (web category links)', () => {
  const setProducts = vi.fn();
  const setSelectedCategoryId = vi.fn();

  beforeEach(() => {
    mockRouter.setCurrentUrl('/');
    mockRouter.locale = 'tk';
    vi.clearAllMocks();

    const category = rootPopularCategory({
      id: 'footer-category-id',
      slug: 'footer-category-slug',
      name: JSON.stringify({ tk: 'FooterCat', en: 'FooterCat' }),
    });

    vi.mocked(useCategoryContext).mockReturnValue({
      categories: [category],
      setCategories: vi.fn(),
      selectedCategoryId: undefined,
      setSelectedCategoryId,
    });

    vi.mocked(useProductContext).mockReturnValue({
      products: [],
      setProducts,
      selectedProduct: undefined,
      setSelectedProduct: vi.fn(),
      searchKeyword: undefined,
      setSearchKeyword: vi.fn(),
      colorsMap: new Map(),
    });

    vi.mocked(useUserContext).mockReturnValue({
      user: undefined,
      setUser: vi.fn(),
      accessToken: '',
      setAccessToken: vi.fn(),
      isLoading: false,
    });

    vi.mocked(useStalePrices).mockReturnValue({
      staleByProductId: {},
      staleCount: 0,
      refresh: vi.fn(),
    });
  });

  it('clears products, selects category, and navigates to /product-category/:slug', async () => {
    const user = userEvent.setup();
    renderWithProviders(createElement(Footer));

    await user.click(screen.getByText('FooterCat'));

    expect(setProducts).toHaveBeenCalledWith([]);
    expect(setSelectedCategoryId).toHaveBeenCalledWith('footer-category-id');
    expect(mockRouter.asPath).toBe('/product-category/footer-category-slug');
  });
});

describe('Footer profile tab red dot', () => {
  beforeEach(() => {
    vi.mocked(useCategoryContext).mockReturnValue({
      categories: [],
      setCategories: vi.fn(),
      selectedCategoryId: undefined,
      setSelectedCategoryId: vi.fn(),
    });
    vi.mocked(useProductContext).mockReturnValue({
      setProducts: vi.fn(),
    } as never);
  });

  it('shows while any price is stale', () => {
    vi.mocked(useStalePrices).mockReturnValue({
      staleByProductId: {},
      staleCount: 3,
      refresh: vi.fn(),
    });
    renderWithProviders(createElement(Footer));

    const dot = screen.getByRole('status', {
      name: 'Some prices need updating',
    });
    expect(dot.closest('button')).toHaveTextContent('Profile');
  });

  it('is absent when nothing is stale', () => {
    vi.mocked(useStalePrices).mockReturnValue({
      staleByProductId: {},
      staleCount: 0,
      refresh: vi.fn(),
    });
    renderWithProviders(createElement(Footer));

    expect(
      screen.queryByRole('status', { name: 'Some prices need updating' }),
    ).not.toBeInTheDocument();
  });
});
