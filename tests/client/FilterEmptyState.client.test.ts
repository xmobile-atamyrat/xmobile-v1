// @vitest-environment jsdom

import FilterEmptyState from '@/pages/components/FilterEmptyState';
import { FilterOptions } from '@/pages/lib/hooks/useFilterOptions';
import { fireEvent, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

const empty = (relaxations: FilterOptions['relaxations']): FilterOptions => ({
  total: 0,
  relaxations,
  brandCounts: {},
  colorCounts: {},
  price: null,
});

function renderState(options: FilterOptions | null, onChange = vi.fn()) {
  renderWithProviders(createElement(FilterEmptyState, { options, onChange }));
  return onChange;
}

describe('FilterEmptyState', () => {
  it('suggests the filter whose removal brings back the most products first', () => {
    renderState(empty({ brands: 3, colors: 12 }));

    const suggestions = screen
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(suggestions).toEqual([
      'Without “Color”: 12 products',
      'Without “Brands”: 3 products',
      'Clear all',
    ]);
  });

  it('drops just that filter when a suggestion is clicked', () => {
    const onChange = renderState(empty({ colors: 12 }));

    fireEvent.click(screen.getByText('Without “Color”: 12 products'));

    expect(onChange).toHaveBeenCalledWith({ colors: [] });
  });

  it('skips removals that would still show nothing, leaving Clear all', () => {
    const onChange = renderState(empty({ colors: 0, inStock: 0 }));

    expect(screen.queryByText(/Without/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Clear all'));
    expect(onChange).toHaveBeenCalledWith({ colors: [], inStock: false });
  });

  it('offers no Clear all when one suggestion already covers it', () => {
    renderState(empty({ inStock: 8 }));

    expect(
      screen.getByText('Without “In stock only”: 8 products'),
    ).toBeVisible();
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });

  it('stays out of the way when results exist or nothing is known', () => {
    renderState({ ...empty({ brands: 3 }), total: 5 });
    renderState(null);
    renderState(empty({}));

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
