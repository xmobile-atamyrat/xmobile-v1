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
      options: { colorCounts: { red: 4 }, brandCounts: {} },
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
    expect(screen.getByLabelText(/^Red/)).toHaveAttribute('type', 'checkbox');
  });

  it('shows how many products each family would show', async () => {
    await renderSidebar();

    const row = (await screen.findByTitle('Red')).closest(
      'label',
    ) as HTMLElement;
    expect(within(row).getByText('4')).toBeInTheDocument();
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

  it('lists families with the most products first, ties in family order', async () => {
    await renderSidebar({
      options: {
        colorCounts: { blue: 1, black: 1, green: 9 },
        brandCounts: {},
      },
    });

    await screen.findByTitle('Black');
    const labels = screen
      .getAllByRole('checkbox')
      .map((box) => box.closest('label')?.textContent)
      .filter((text) => text !== 'In stock only');
    expect(labels).toEqual(['Green 9', 'Black 1', 'Blue 1']);
  });

  it('keeps a ticked family that other filters ruled out, so it can be unticked', async () => {
    await renderSidebar({
      selectedColors: ['green'],
      options: { colorCounts: { red: 4 }, brandCounts: {} },
    });

    expect(await screen.findByTitle('Green')).toBeInTheDocument();
  });

  it('collapses a long colour list behind "Show more"', async () => {
    await renderSidebar({
      options: {
        colorCounts: {
          black: 1,
          white: 1,
          silver: 1,
          gray: 1,
          gold: 1,
          brown: 1,
          red: 1,
          orange: 1,
          blue: 1,
        },
        brandCounts: {},
      },
    });

    expect(await screen.findByTitle('Red')).toBeInTheDocument();
    expect(screen.queryByTitle('Orange')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show more'));

    expect(await screen.findByTitle('Blue')).toBeInTheDocument();
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });

  it('hides the color section when no family matches', async () => {
    await renderSidebar({ options: { colorCounts: {}, brandCounts: {} } });

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
      options: { colorCounts: {}, brandCounts: { apple: 7, xiaomi: 2 } },
    });

    expect(await screen.findByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Xiaomi')).toBeInTheDocument();
    expect(screen.queryByText('Samsung')).not.toBeInTheDocument();
  });

  it('counts brands for this listing, not the whole catalogue', async () => {
    await renderSidebar({
      options: { colorCounts: {}, brandCounts: { apple: 7 } },
    });

    const row = (await screen.findByText('Apple')).closest(
      'label',
    ) as HTMLElement;
    expect(within(row).getByText('7')).toBeInTheDocument();
  });

  it('lists brands with the most products first, ties by name', async () => {
    await renderSidebar({
      options: {
        colorCounts: {},
        brandCounts: { apple: 2, samsung: 9, xiaomi: 2 },
      },
    });

    await screen.findByText('Samsung');
    const labels = screen
      .getAllByRole('checkbox')
      .map((box) => box.closest('label')?.textContent)
      .filter((text) => text !== 'In stock only');
    expect(labels).toEqual(['Samsung 9', 'Apple 2', 'Xiaomi 2']);
  });

  it('keeps a ticked brand that other filters ruled out', async () => {
    await renderSidebar({
      selectedBrandIds: ['samsung'],
      options: { colorCounts: {}, brandCounts: { apple: 7 } },
    });

    const row = (await screen.findByText('Samsung')).closest(
      'label',
    ) as HTMLElement;
    expect(within(row).getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('Xiaomi')).not.toBeInTheDocument();
  });

  it('lists every brand while the options are unknown', async () => {
    await renderSidebar({ options: null });

    expect(await screen.findByText('Samsung')).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Xiaomi')).toBeInTheDocument();
    // Brand.productCount spans the whole catalogue; no count beats a wrong one.
    expect(screen.queryByText('5')).not.toBeInTheDocument();
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
