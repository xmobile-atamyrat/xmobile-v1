// @vitest-environment jsdom

import PopularCategoriesSection from '@/pages/components/PopularCategoriesSection';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { childCategory, rootPopularCategory } from './helpers/categoryFixtures';
import { renderWithProviders } from './helpers/renderWithProviders';

describe('PopularCategoriesSection navigation', () => {
  beforeEach(() => {
    mockRouter.setCurrentUrl('/');
    mockRouter.locale = 'tk';
  });

  it('shows 6 tiles and expands the rest in place', async () => {
    const user = userEvent.setup();
    const cats = Array.from({ length: 8 }, (_, i) =>
      rootPopularCategory({
        id: `cat-${i + 1}`,
        slug: `cat-${i + 1}`,
        name: JSON.stringify({ tk: `Name ${i + 1}`, en: `Name ${i + 1}` }),
      }),
    );
    renderWithProviders(
      createElement(PopularCategoriesSection, { categories: cats }),
    );

    expect(screen.getByText('Name 6')).toBeTruthy();
    expect(screen.queryByText('Name 7')).toBeNull();

    await user.click(screen.getByText('Other Categories'));

    expect(screen.getByText('Name 7')).toBeTruthy();
    expect(screen.getByText('Name 8')).toBeTruthy();
    expect(mockRouter.asPath).toBe('/');

    await user.click(screen.getByText('Show less'));

    expect(screen.queryByText('Name 7')).toBeNull();
  });

  it('hides the toggle when nothing is left', () => {
    const cats = [1, 2, 3].map((i) =>
      rootPopularCategory({ id: `cat-${i}`, slug: `cat-${i}` }),
    );
    renderWithProviders(
      createElement(PopularCategoriesSection, { categories: cats }),
    );

    expect(screen.queryByText('Other Categories')).toBeNull();
  });

  it('opens a parent at /category/:slug', async () => {
    const user = userEvent.setup();
    const cat = rootPopularCategory({
      slug: 'smartphones',
      name: JSON.stringify({ tk: 'Telefonlar', en: 'Phones' }),
      successorCategories: [childCategory()],
    });
    renderWithProviders(
      createElement(PopularCategoriesSection, { categories: [cat] }),
    );

    await user.click(screen.getByText('Telefonlar'));

    expect(mockRouter.asPath).toBe('/category/smartphones');
  });

  it('opens a leaf at /product-category/:slug', async () => {
    const user = userEvent.setup();
    const cat = rootPopularCategory({
      slug: 'smartphones',
      name: JSON.stringify({ tk: 'Telefonlar', en: 'Phones' }),
      successorCategories: [],
    });
    renderWithProviders(
      createElement(PopularCategoriesSection, { categories: [cat] }),
    );

    await user.click(screen.getByText('Telefonlar'));

    expect(mockRouter.asPath).toBe('/product-category/smartphones');
  });
});
