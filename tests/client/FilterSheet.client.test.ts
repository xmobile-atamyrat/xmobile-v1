// @vitest-environment jsdom

import FilterSheet from '@/pages/components/FilterSheet';
import { FilterOptions } from '@/pages/lib/hooks/useFilterOptions';
import { FilterState } from '@/pages/lib/hooks/useProductFilters';
import { act, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/apis', () => ({
  fetchBrands: async (): Promise<never[]> => [],
  fetchProductFilterOptions: vi.fn(),
}));

vi.mock('@/pages/lib/CategoryContext', () => ({
  useCategoryContext: () => ({ categories: [] as never[] }),
}));

vi.mock('@/pages/components/SortDropdown', () => ({
  default: (): null => null,
}));

const filters: FilterState = {
  categoryIds: [],
  brandIds: [],
  colors: [],
  minPrice: '',
  maxPrice: '',
  sortBy: '',
  inStock: false,
};

const withTotal = (total: number): FilterOptions => ({
  total,
  relaxations: {},
  brandCounts: {},
  colorCounts: {},
  price: null,
});

async function renderSheet(computeOptions?: () => FilterOptions) {
  renderWithProviders(
    createElement(FilterSheet, {
      open: true,
      onClose: vi.fn(),
      filters,
      onApply: vi.fn(),
      computeOptions,
    }),
  );
  await act(async () => {});
}

describe('FilterSheet Apply button', () => {
  it('says how many products applying will show', async () => {
    await renderSheet(() => withTotal(37));

    expect(
      screen.getByRole('button', { name: 'Show 37 products' }),
    ).toBeInTheDocument();
  });

  it('warns before applying a choice that shows nothing', async () => {
    await renderSheet(() => withTotal(0));

    expect(
      screen.getByRole('button', { name: 'No products' }),
    ).toBeInTheDocument();
  });

  it('falls back to Apply while the count is unknown', async () => {
    await renderSheet();

    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });
});
