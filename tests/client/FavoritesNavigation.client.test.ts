// @vitest-environment jsdom

import CustomAppBar from '@/pages/components/Appbar';
import Footer from '@/pages/components/Footer';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useUserContext } from '@/pages/lib/UserContext';
import AccountNav from '@/pages/user/components/AccountNav';
import { fireEvent, screen, within } from '@testing-library/react';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/pages/components/CategoryMegaMenu', () => ({
  default: (): null => null,
}));

describe('Favorites navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter.setCurrentUrl('/');
    mockRouter.locale = 'en';

    vi.mocked(useCategoryContext).mockReturnValue({
      categories: [],
      setSelectedCategoryId: vi.fn(),
    } as never);
    vi.mocked(useProductContext).mockReturnValue({
      setProducts: vi.fn(),
      searchKeyword: '',
      setSearchKeyword: vi.fn(),
    } as never);
    vi.mocked(useUserContext).mockReturnValue({
      user: undefined,
      setUser: vi.fn(),
      accessToken: '',
      setAccessToken: vi.fn(),
      isLoading: false,
    });
  });

  it('opens favorites from the bottom bar', () => {
    renderWithProviders(createElement(Footer));
    const bar = within(screen.getByRole('navigation'));

    fireEvent.click(bar.getByRole('button', { name: 'Favorites' }));

    expect(mockRouter.asPath).toBe('/favorites');
  });

  it('no longer has a search tab in the bottom bar', () => {
    renderWithProviders(createElement(Footer));
    const bar = within(screen.getByRole('navigation'));

    expect(
      bar.queryByRole('button', { name: 'Search' }),
    ).not.toBeInTheDocument();
  });

  it('opens favorites from the web header, for guests too', () => {
    renderWithProviders(createElement(CustomAppBar));

    fireEvent.click(screen.getByRole('button', { name: 'Favorites' }));

    expect(mockRouter.asPath).toBe('/favorites');
  });

  it('opens favorites from the account rail', () => {
    renderWithProviders(createElement(AccountNav, { active: 'account' }));

    fireEvent.click(screen.getByRole('button', { name: 'Favorites' }));

    expect(mockRouter.asPath).toBe('/favorites');
  });
});
