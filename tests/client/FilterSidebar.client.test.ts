// @vitest-environment jsdom

import FilterSidebar from '@/pages/components/FilterSidebar';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/apis', () => ({
  fetchColors: vi.fn(),
  fetchProductFilterOptions: vi.fn(),
  fetchBrands: vi.fn(),
}));

vi.mock('@/pages/components/SortDropdown', () => ({
  default: () => createElement('div', { 'data-testid': 'sort-dropdown' }),
}));

const RED_COLOR = {
  id: 'c1',
  name: 'Red',
  hex: '#ff0000',
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function getApis() {
  const { fetchColors, fetchProductFilterOptions, fetchBrands } = await import(
    '@/pages/lib/apis'
  );
  return {
    fetchColors: vi.mocked(fetchColors),
    fetchProductFilterOptions: vi.mocked(fetchProductFilterOptions),
    fetchBrands: vi.mocked(fetchBrands),
  };
}

function renderSidebar(
  overrides: Partial<Parameters<typeof FilterSidebar>[0]> = {},
  onFilterChange = vi.fn(),
) {
  return renderWithProviders(
    createElement(FilterSidebar, {
      categories: [],
      selectedCategoryIds: [],
      selectedBrandIds: [],
      selectedColorIds: [],
      minPrice: '',
      maxPrice: '',
      onFilterChange,
      ...overrides,
    }),
  );
}

describe('FilterSidebar — color filter section', () => {
  beforeEach(async () => {
    const apis = await getApis();
    apis.fetchColors.mockResolvedValue([RED_COLOR]);
    apis.fetchProductFilterOptions.mockResolvedValue({ colors: ['c1'] });
    apis.fetchBrands.mockResolvedValue([]);
  });

  it('renders a checkbox for each color returned by fetchColors that is in filterOptions', async () => {
    renderSidebar();
    await waitFor(() => {
      // The swatch has title={color.name}
      expect(screen.getByTitle('Red')).toBeInTheDocument();
    });
  });

  it('clicking the color swatch calls onFilterChange with the toggled colorId', async () => {
    const onFilterChange = vi.fn();
    renderSidebar({ selectedColorIds: [] }, onFilterChange);

    await waitFor(() => expect(screen.getByTitle('Red')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Red'));
    expect(onFilterChange).toHaveBeenCalledWith({ colorIds: ['c1'] });
  });

  it('the checkbox is checked when colorId is in selectedColorIds', async () => {
    renderSidebar({ selectedColorIds: ['c1'] });

    await waitFor(() => expect(screen.getByTitle('Red')).toBeInTheDocument());

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('clicking a checked color calls onFilterChange with the colorId removed', async () => {
    const onFilterChange = vi.fn();
    renderSidebar({ selectedColorIds: ['c1'] }, onFilterChange);

    await waitFor(() => expect(screen.getByTitle('Red')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Red'));
    expect(onFilterChange).toHaveBeenCalledWith({ colorIds: [] });
  });

  it('hides the color section when filterOptions.colors is empty', async () => {
    const apis = await getApis();
    apis.fetchProductFilterOptions.mockResolvedValue({ colors: [] });

    renderSidebar();

    // Wait for async effects to settle, then verify swatch is absent
    await waitFor(() => {
      expect(screen.queryByTitle('Red')).not.toBeInTheDocument();
    });
  });
});
