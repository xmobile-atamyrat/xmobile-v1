// @vitest-environment jsdom

import FilterSidebar from '@/pages/components/FilterSidebar';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/apis', () => ({
  fetchBrands: vi.fn(),
}));

vi.mock('@/pages/components/SortDropdown', () => ({
  default: () => createElement('div', { 'data-testid': 'sort-dropdown' }),
}));

const BRANDS = [
  { id: 'apple', name: 'Apple', productCount: 3 },
  { id: 'samsung', name: 'Samsung', productCount: 5 },
  { id: 'xiaomi', name: 'Xiaomi', productCount: 2 },
];

async function mockBrands(brands: typeof BRANDS) {
  const { fetchBrands } = await import('@/pages/lib/apis');
  vi.mocked(fetchBrands).mockResolvedValue(
    brands as Awaited<ReturnType<typeof fetchBrands>>,
  );
}

// Settles the mount-time brand fetch: its re-render remounts the rail's rows,
// which would leave a test holding a detached element.
async function renderSidebar(
  overrides: Partial<Parameters<typeof FilterSidebar>[0]> = {},
  onFilterChange = vi.fn(),
) {
  const view = renderWithProviders(
    createElement(FilterSidebar, {
      categories: [],
      selectedCategoryIds: [],
      selectedBrandIds: [],
      selectedColors: [],
      minPrice: '',
      maxPrice: '',
      onFilterChange,
      options: { colorFamilies: ['red'], brandIds: [] },
      ...overrides,
    }),
  );
  await act(async () => {});
  return view;
}

describe('FilterSidebar — color filter section', () => {
  beforeEach(() => mockBrands([]));

  it('shows a labelled swatch for each available colour family', async () => {
    await renderSidebar();

    expect(await screen.findByTitle('Red')).toBeInTheDocument();
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByLabelText('Red')).toHaveAttribute('type', 'checkbox');
  });

  it('clicking the color swatch calls onFilterChange with its family', async () => {
    const onFilterChange = vi.fn();
    await renderSidebar({ selectedColors: [] }, onFilterChange);

    fireEvent.click(await screen.findByTitle('Red'));
    expect(onFilterChange).toHaveBeenCalledWith({ colors: ['red'] });
  });

  it('the checkbox is checked when its family is selected', async () => {
    await renderSidebar({ selectedColors: ['red'] });

    const row = (await screen.findByTitle('Red')).closest(
      'label',
    ) as HTMLElement;
    expect(within(row).getByRole('checkbox')).toBeChecked();
  });

  it('clicking a checked color calls onFilterChange with its family removed', async () => {
    const onFilterChange = vi.fn();
    await renderSidebar({ selectedColors: ['red'] }, onFilterChange);

    fireEvent.click(await screen.findByTitle('Red'));
    expect(onFilterChange).toHaveBeenCalledWith({ colors: [] });
  });

  it('lists families in a fixed order, whatever order they arrive in', async () => {
    await renderSidebar({
      options: { colorFamilies: ['blue', 'black'], brandIds: [] },
    });

    await screen.findByTitle('Black');
    const labels = screen
      .getAllByRole('checkbox')
      .map((box) => box.closest('label')?.textContent);
    expect(labels.indexOf('Black')).toBeLessThan(labels.indexOf('Blue'));
  });

  it('keeps a ticked family that other filters ruled out, so it can be unticked', async () => {
    await renderSidebar({
      selectedColors: ['green'],
      options: { colorFamilies: ['red'], brandIds: [] },
    });

    expect(await screen.findByTitle('Green')).toBeInTheDocument();
  });

  it('hides the color section when no family matches', async () => {
    await renderSidebar({ options: { colorFamilies: [], brandIds: [] } });

    expect(screen.queryByText('Color')).not.toBeInTheDocument();
  });

  it('hides the color section until the options arrive', async () => {
    await renderSidebar({ options: null });

    expect(screen.queryByText('Color')).not.toBeInTheDocument();
  });
});

describe('FilterSidebar — brand section', () => {
  beforeEach(() => mockBrands(BRANDS));

  it('lists only brands that match the listing', async () => {
    await renderSidebar({
      options: { colorFamilies: [], brandIds: ['apple', 'xiaomi'] },
    });

    expect(await screen.findByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Xiaomi')).toBeInTheDocument();
    expect(screen.queryByText('Samsung')).not.toBeInTheDocument();
  });

  it('keeps a ticked brand that other filters ruled out', async () => {
    await renderSidebar({
      selectedBrandIds: ['samsung'],
      options: { colorFamilies: [], brandIds: ['apple'] },
    });

    expect(await screen.findByText('Samsung')).toBeInTheDocument();
    expect(screen.queryByText('Xiaomi')).not.toBeInTheDocument();
  });

  it('lists every brand while the options are unknown', async () => {
    await renderSidebar({ options: null });

    expect(await screen.findByText('Samsung')).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Xiaomi')).toBeInTheDocument();
  });
});

describe('FilterSidebar — availability section', () => {
  beforeEach(() => mockBrands([]));

  it('turns the in-stock filter on', async () => {
    const onFilterChange = vi.fn();
    await renderSidebar({ inStock: false }, onFilterChange);

    fireEvent.click(screen.getByLabelText('In stock only'));

    expect(onFilterChange).toHaveBeenCalledWith({ inStock: true });
  });

  it('shows the in-stock filter as checked when active', async () => {
    await renderSidebar({ inStock: true });

    expect(await screen.findByLabelText('In stock only')).toBeChecked();
  });
});
