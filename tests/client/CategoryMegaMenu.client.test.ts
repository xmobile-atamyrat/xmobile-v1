// @vitest-environment jsdom

import CategoryMegaMenu from '@/pages/components/CategoryMegaMenu';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { childCategory, rootPopularCategory } from './helpers/categoryFixtures';
import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/CategoryContext', () => ({
  useCategoryContext: vi.fn(),
}));

vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: vi.fn(),
}));

const leaf = childCategory({
  id: 'cat-leaf',
  slug: 'apple',
  name: JSON.stringify({ tk: 'iPhone', en: 'iPhone' }),
});

const branch = childCategory({
  id: 'cat-branch',
  slug: 'xiaomi',
  name: JSON.stringify({ tk: 'Xiaomi', en: 'Xiaomi' }),
  successorCategories: [
    childCategory({
      id: 'cat-grandchild',
      slug: 'redmi',
      name: JSON.stringify({ tk: 'Redmi', en: 'Redmi' }),
    }),
  ],
});

const root = rootPopularCategory({
  id: 'cat-root',
  slug: 'phones',
  name: JSON.stringify({ tk: 'Telefonlar', en: 'Phones' }),
  successorCategories: [leaf, branch],
});

describe('CategoryMegaMenu', () => {
  const setSelectedCategoryId = vi.fn();
  const onClose = vi.fn();
  const onNavigate = vi.fn();

  const renderMenu = (open = true) =>
    renderWithProviders(
      createElement(CategoryMegaMenu, {
        categories: [root],
        open,
        onClose,
        onNavigate,
      }),
    );

  beforeEach(() => {
    mockRouter.setCurrentUrl('/');
    mockRouter.locale = 'tk';
    vi.clearAllMocks();

    vi.mocked(useCategoryContext).mockReturnValue({
      categories: [root],
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

  it('renders nothing while closed', () => {
    renderMenu(false);

    expect(screen.queryByText('Telefonlar')).toBeNull();
  });

  it('groups leaf children under the open category and branches under their own heading', () => {
    renderMenu();

    // Rail row + the leaf group heading + the promo card all name the root.
    expect(screen.getAllByText('Telefonlar').length).toBeGreaterThan(1);
    expect(screen.getByText('iPhone')).toBeTruthy();
    // A child with children of its own becomes a heading over them.
    expect(screen.getByText('Xiaomi')).toBeTruthy();
    expect(screen.getByText('Redmi')).toBeTruthy();
  });

  it('closes and delegates navigation when a subcategory is clicked', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByText('Redmi'));

    expect(onClose).toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cat-grandchild', slug: 'redmi' }),
    );
  });

  it('hides the admin edit affordance from non-admins', () => {
    renderMenu();

    expect(screen.queryByText('Edit')).toBeNull();
  });
});
