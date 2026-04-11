// @vitest-environment jsdom

import StyledBreadcrumbs from '@/pages/components/StyledBreadcrumbs';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { childCategory, rootPopularCategory } from './helpers/categoryFixtures';
import { renderWithProviders } from './helpers/renderWithProviders';

describe('StyledBreadcrumbs navigation', () => {
  beforeEach(() => {
    mockRouter.setCurrentUrl('/');
    mockRouter.locale = 'tk';
  });

  it('renders nothing when categoryPath is empty', () => {
    const { container } = renderWithProviders(
      createElement(StyledBreadcrumbs, { categoryPath: [] }),
    );
    expect(container.firstChild).toBeNull();
  });

  it('pushes /category/:slug for each ancestor crumb (not the current leaf)', async () => {
    const user = userEvent.setup();
    const root = rootPopularCategory({
      slug: 'ancestor-slug',
      name: JSON.stringify({ tk: 'Ancestor', en: 'Ancestor' }),
    });
    const leaf = childCategory({
      slug: 'current-leaf',
      name: JSON.stringify({ tk: 'Current', en: 'Current' }),
      predecessorId: root.id,
    });

    renderWithProviders(
      createElement(StyledBreadcrumbs, {
        categoryPath: [root, leaf],
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Ancestor' }));

    expect(mockRouter.asPath).toBe('/category/ancestor-slug');
  });
});
