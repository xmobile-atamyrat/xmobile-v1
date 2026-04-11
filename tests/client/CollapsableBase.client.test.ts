// @vitest-environment jsdom

import CollapsableBase from '@/pages/components/CollapsableBase';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/CategoryContext', () => ({
  useCategoryContext: vi.fn(),
}));

vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: vi.fn(),
}));

describe('CollapsableBase navigation', () => {
  const setSelectedCategoryId = vi.fn();
  const closeDrawer = vi.fn();

  beforeEach(() => {
    mockRouter.setCurrentUrl('/');
    mockRouter.locale = 'tk';
    vi.clearAllMocks();

    vi.mocked(useCategoryContext).mockReturnValue({
      categories: [],
      setCategories: vi.fn(),
      selectedCategoryId: undefined,
      setSelectedCategoryId,
    });

    vi.mocked(useUserContext).mockReturnValue({
      user: undefined,
      setUser: vi.fn(),
      accessToken: '',
      setAccessToken: vi.fn(),
      isLoading: false,
    });
  });

  it('navigates to /product-category/:slug when the row is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      createElement(CollapsableBase, {
        categoryTitle: JSON.stringify({ tk: 'DrawerCat', en: 'DrawerCat' }),
        id: 'internal-id-123',
        slug: 'drawer-slug',
        setEditCategoriesModal: vi.fn(),
        setDeleteCategoriesModal: vi.fn(),
        closeDrawer,
      }),
    );

    await user.click(screen.getByText('DrawerCat'));

    expect(setSelectedCategoryId).toHaveBeenCalledWith('internal-id-123');
    expect(closeDrawer).toHaveBeenCalled();
    expect(mockRouter.asPath).toBe('/product-category/drawer-slug');
  });
});
