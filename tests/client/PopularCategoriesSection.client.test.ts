// @vitest-environment jsdom

import PopularCategoriesSection from '@/pages/components/PopularCategoriesSection';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { rootPopularCategory } from './helpers/categoryFixtures';
import { renderWithProviders } from './helpers/renderWithProviders';

describe('PopularCategoriesSection navigation', () => {
  beforeEach(() => {
    mockRouter.setCurrentUrl('/');
    mockRouter.locale = 'tk';
  });

  it('navigates to /category/:slug when a popular card is clicked', async () => {
    const user = userEvent.setup();
    const cat = rootPopularCategory({
      slug: 'smartphones',
      name: JSON.stringify({ tk: 'Telefonlar', en: 'Phones' }),
    });
    renderWithProviders(
      createElement(PopularCategoriesSection, { categories: [cat] }),
    );

    await user.click(screen.getByText('Telefonlar'));

    expect(mockRouter.asPath).toBe('/category/smartphones');
  });

  it('navigates to /category when "more" row is clicked', async () => {
    const user = userEvent.setup();
    const cat = rootPopularCategory();
    renderWithProviders(
      createElement(PopularCategoriesSection, { categories: [cat] }),
    );

    await user.click(screen.getByText('Other Categories'));

    expect(mockRouter.asPath).toBe('/category');
  });
});
