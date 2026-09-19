// @vitest-environment jsdom

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import mockRouter from 'next-router-mock';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock calls below are hoisted above these imports by vitest.
import CategoryPage from '@/pages/category/[slug].page';
import { usePlatform } from '@/pages/lib/PlatformContext';
import type { ExtendedCategory } from '@/pages/lib/types';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/PlatformContext', async () => {
  const actual = await vi.importActual<
    typeof import('@/pages/lib/PlatformContext')
  >('@/pages/lib/PlatformContext');
  return { ...actual, usePlatform: vi.fn() };
});

// Layout pulls in the whole Appbar/category fetching stack; the back row under
// test sits outside it.
vi.mock('@/pages/components/Layout', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/pages/components/SimpleBreadcrumbs', () => ({
  default: (): null => null,
}));
vi.mock('@/pages/components/CategoryCard', () => ({
  default: (): null => null,
}));

vi.mock('@/pages/lib/CategoryContext', () => ({
  useCategoryContext: () => ({ setSelectedCategoryId: vi.fn() }),
}));

vi.mock('@/pages/lib/ProductContext', () => ({
  useProductContext: () => ({ setProducts: vi.fn() }),
}));

function makeCategory(slug: string, name: string): ExtendedCategory {
  return {
    id: `id-${slug}`,
    slug,
    name: JSON.stringify({ tk: name, en: name, ru: name }),
    successorCategories: [],
  } as unknown as ExtendedCategory;
}

const phones = makeCategory('phones', 'Phones');
const electronics = makeCategory('electronics', 'Electronics');

function renderPage(parentCategory: ExtendedCategory | null) {
  return renderWithProviders(
    createElement(CategoryPage, {
      category: phones,
      parentCategory,
      categoryPath: parentCategory ? [parentCategory, phones] : [phones],
    }),
  );
}

describe('CategoryPage back button', () => {
  beforeEach(() => {
    mockRouter.setCurrentUrl('/category/phones');
    mockRouter.locale = 'tk';
  });

  // Reported bug: subcategory pages had no back button on mobile, because the
  // mobile Appbar returns null off the home screen and swallowed the
  // handleHeaderBackButton this page was passing it.
  it('is visible on mobile', () => {
    vi.mocked(usePlatform).mockReturnValue('mobile');

    renderPage(electronics);

    const button = screen.getByRole('button', { name: /back/i });
    expect(button.className).not.toContain('hidden');
  });

  it('stays hidden on web, which has its own header back button', () => {
    vi.mocked(usePlatform).mockReturnValue('web');

    renderPage(electronics);

    const button = screen.getByRole('button', { name: /back/i });
    expect(button.className).toContain('hidden');
  });

  it('navigates to the parent category', async () => {
    vi.mocked(usePlatform).mockReturnValue('mobile');
    const user = userEvent.setup();

    renderPage(electronics);
    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(mockRouter.asPath).toBe('/category/electronics');
  });

  it('falls back to the home page at the top of the tree', async () => {
    vi.mocked(usePlatform).mockReturnValue('mobile');
    const user = userEvent.setup();

    renderPage(null);
    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(mockRouter.asPath).toBe('/');
  });
});
