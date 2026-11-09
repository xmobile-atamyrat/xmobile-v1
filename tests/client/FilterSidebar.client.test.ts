// @vitest-environment jsdom

import FilterSidebar from '@/pages/components/FilterSidebar';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
  brandId: null as string | null,
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
      selectedColors: [],
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

  it('clicking the color swatch calls onFilterChange with its family', async () => {
    const onFilterChange = vi.fn();
    renderSidebar({ selectedColors: [] }, onFilterChange);

    await waitFor(() => expect(screen.getByTitle('Red')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Red'));
    expect(onFilterChange).toHaveBeenCalledWith({ colors: ['red'] });
  });

  it('the checkbox is checked when its family is selected', async () => {
    renderSidebar({ selectedColors: ['red'] });

    await waitFor(() => expect(screen.getByTitle('Red')).toBeInTheDocument());

    const row = screen.getByTitle('Red').closest('label') as HTMLElement;
    expect(within(row).getByRole('checkbox')).toBeChecked();
  });

  it('labels each swatch with the color name', async () => {
    renderSidebar();

    expect(await screen.findByText('Red')).toBeInTheDocument();
    expect(screen.getByLabelText('Red')).toHaveAttribute('type', 'checkbox');
  });

  it('clicking a checked color calls onFilterChange with its family removed', async () => {
    const onFilterChange = vi.fn();
    renderSidebar({ selectedColors: ['red'] }, onFilterChange);

    await waitFor(() => expect(screen.getByTitle('Red')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Red'));
    expect(onFilterChange).toHaveBeenCalledWith({ colors: [] });
  });

  it('shows one swatch for identical colors from different brands', async () => {
    const apis = await getApis();
    apis.fetchColors.mockResolvedValue([
      RED_COLOR,
      { ...RED_COLOR, id: 'c2', brandId: 'b1' },
    ]);
    apis.fetchProductFilterOptions.mockResolvedValue({ colors: ['c1', 'c2'] });
    const onFilterChange = vi.fn();
    renderSidebar({ selectedColors: [] }, onFilterChange);

    await waitFor(() => expect(screen.getByTitle('Red')).toBeInTheDocument());
    expect(screen.getAllByTitle('Red')).toHaveLength(1);

    fireEvent.click(screen.getByTitle('Red'));
    expect(onFilterChange).toHaveBeenCalledWith({ colors: ['red'] });
  });

  it('groups differently named shades into one family row', async () => {
    const apis = await getApis();
    apis.fetchColors.mockResolvedValue([
      { ...RED_COLOR, id: 'k1', name: 'Phantom Black', hex: '#1a1a1a' },
      { ...RED_COLOR, id: 'k2', name: 'Midnight', hex: '#000002' },
    ]);
    apis.fetchProductFilterOptions.mockResolvedValue({ colors: ['k1', 'k2'] });
    const onFilterChange = vi.fn();
    renderSidebar({ selectedColors: [] }, onFilterChange);

    await waitFor(() => expect(screen.getByTitle('Black')).toBeInTheDocument());
    expect(screen.queryByText('Phantom Black')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Black'));
    expect(onFilterChange).toHaveBeenCalledWith({ colors: ['black'] });
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

describe('FilterSidebar — availability section', () => {
  beforeEach(async () => {
    const apis = await getApis();
    apis.fetchColors.mockResolvedValue([]);
    apis.fetchProductFilterOptions.mockResolvedValue({ colors: [] });
    apis.fetchBrands.mockResolvedValue([]);
  });

  it('turns the in-stock filter on', async () => {
    const onFilterChange = vi.fn();
    renderSidebar({ inStock: false }, onFilterChange);
    // The mount-time fetches re-render the rail, which remounts its rows.
    await act(async () => {});

    fireEvent.click(screen.getByLabelText('In stock only'));

    expect(onFilterChange).toHaveBeenCalledWith({ inStock: true });
  });

  it('shows the in-stock filter as checked when active', async () => {
    renderSidebar({ inStock: true });

    expect(await screen.findByLabelText('In stock only')).toBeChecked();
  });
});
