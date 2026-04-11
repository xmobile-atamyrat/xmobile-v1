// @vitest-environment jsdom

import Footer from '@/pages/components/Footer';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
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
    });

    vi.mocked(useUserContext).mockReturnValue({
      user: undefined,
      setUser: vi.fn(),
      accessToken: '',
      setAccessToken: vi.fn(),
      isLoading: false,
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
