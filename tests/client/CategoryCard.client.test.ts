// @vitest-environment jsdom

import CategoryCard from '@/pages/components/CategoryCard';
import { ALL_PRODUCTS_CATEGORY_CARD } from '@/pages/lib/constants';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

describe('CategoryCard (all products tile)', () => {
  beforeEach(() => {
    mockRouter.setCurrentUrl('/');
    mockRouter.locale = 'tk';
  });

  it('invokes onClick when the all-products card is activated', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    renderWithProviders(
      createElement(CategoryCard, {
        id: 'all-products',
        name: JSON.stringify({ tk: 'Hemme', en: 'All' }),
        initialImgUrl: ALL_PRODUCTS_CATEGORY_CARD,
        onClick,
      }),
    );

    await user.click(screen.getByText('All Products'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
