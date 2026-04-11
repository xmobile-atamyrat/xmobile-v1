// @vitest-environment jsdom

import SimpleBreadcrumbs from '@/pages/components/SimpleBreadcrumbs';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { childCategory, rootPopularCategory } from './helpers/categoryFixtures';
import { renderWithProviders } from './helpers/renderWithProviders';

describe('SimpleBreadcrumbs navigation', () => {
  beforeEach(() => {
    mockRouter.setCurrentUrl('/product-category/phones');
    mockRouter.pathname = '/product-category/[categorySlug]';
    mockRouter.locale = 'tk';
  });

  it('pushes home when the home crumb is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(createElement(SimpleBreadcrumbs, { categoryPath: [] }));

    await user.click(screen.getByText('Home'));

    expect(mockRouter.asPath).toBe('/');
  });

  it('pushes /category/:slug using category slug (not id) for each segment', async () => {
    const user = userEvent.setup();
    const root = rootPopularCategory({
      id: 'id-root',
      slug: 'root-slug',
      name: JSON.stringify({ tk: 'RootName', en: 'RootName' }),
    });
    const leaf = childCategory({
      id: 'id-leaf',
      slug: 'leaf-slug',
      name: JSON.stringify({ tk: 'LeafName', en: 'LeafName' }),
      predecessorId: root.id,
    });

    renderWithProviders(
      createElement(SimpleBreadcrumbs, { categoryPath: [root, leaf] }),
    );

    await user.click(screen.getByText('RootName'));
    expect(mockRouter.asPath).toBe('/category/root-slug');

    mockRouter.setCurrentUrl('/product-category/phones');
    await user.click(screen.getByText('LeafName'));
    expect(mockRouter.asPath).toBe('/category/leaf-slug');
  });
});
