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
      options: {
        total: 1,
        relaxations: {},
        colorCounts: { red: 4 },
        brandCounts: {},
        price: null,
      },
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
        total: 1,
        relaxations: {},
        colorCounts: { blue: 1, black: 1, green: 9 },
        brandCounts: {},
        price: null,
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
      options: {
        total: 1,
        relaxations: {},
        colorCounts: { red: 4 },
        brandCounts: {},
        price: null,
      },
    });

    expect(await screen.findByTitle('Green')).toBeInTheDocument();
  });

  it('collapses a long colour list behind "Show more"', async () => {
    await renderSidebar({
      options: {
        total: 1,
        relaxations: {},
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
        price: null,
      },
    });

    expect(await screen.findByTitle('Red')).toBeInTheDocument();
    expect(screen.queryByTitle('Orange')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show more'));

    expect(await screen.findByTitle('Blue')).toBeInTheDocument();
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });

  it('hides the color section when no family matches', async () => {
    await renderSidebar({
      options: {
        total: 1,
        relaxations: {},
        colorCounts: {},
        brandCounts: {},
        price: null,
      },
    });

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
      options: {
        total: 1,
        relaxations: {},
        colorCounts: {},
        brandCounts: { apple: 7, xiaomi: 2 },
        price: null,
      },
    });

    expect(await screen.findByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Xiaomi')).toBeInTheDocument();
    expect(screen.queryByText('Samsung')).not.toBeInTheDocument();
  });

  it('counts brands for this listing, not the whole catalogue', async () => {
    await renderSidebar({
      options: {
        total: 1,
        relaxations: {},
        colorCounts: {},
        brandCounts: { apple: 7 },
        price: null,
      },
    });

    const row = (await screen.findByText('Apple')).closest(
      'label',
    ) as HTMLElement;
    expect(within(row).getByText('7')).toBeInTheDocument();
  });

  it('keeps the admin order whatever the counts', async () => {
    await renderSidebar({
      options: {
        total: 1,
        relaxations: {},
        colorCounts: {},
        brandCounts: { apple: 2, samsung: 9, xiaomi: 2 },
        price: null,
      },
    });

    await screen.findByText('Samsung');
    const labels = screen
      .getAllByRole('checkbox')
      .map((box) => box.closest('label')?.textContent)
      .filter((text) => text !== 'In stock only');
    expect(labels).toEqual(['Apple 2', 'Samsung 9', 'Xiaomi 2']);
  });

  it('keeps a ticked brand that other filters ruled out', async () => {
    await renderSidebar({
      selectedBrandIds: ['samsung'],
      options: {
        total: 1,
        relaxations: {},
        colorCounts: {},
        brandCounts: { apple: 7 },
        price: null,
      },
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

describe('FilterSidebar — price section', () => {
  beforeEach(() => mockBrands([]));

  const price = {
    min: 1200,
    max: 24000,
    buckets: [
      { min: null, max: 3000, count: 4 },
      { min: 3000, max: 9000, count: 6 },
      { min: 9000, max: null, count: 2 },
    ],
  };

  it('offers quick price ranges with their counts', async () => {
    await renderSidebar({
      options: {
        total: 1,
        relaxations: {},
        colorCounts: {},
        brandCounts: {},
        price,
      },
    });

    expect(screen.getByLabelText('0 – 3 000 TMT 4')).toBeInTheDocument();
    expect(screen.getByLabelText('3 000 – 9 000 TMT 6')).toBeInTheDocument();
    expect(screen.getByLabelText('9 000+ TMT 2')).toBeInTheDocument();
  });

  it('applies a quick range, and clears it when clicked again', async () => {
    const onFilterChange = vi.fn();
    await renderSidebar(
      {
        options: {
          total: 1,
          relaxations: {},
          colorCounts: {},
          brandCounts: {},
          price,
        },
      },
      onFilterChange,
    );
    fireEvent.click(screen.getByLabelText('3 000 – 9 000 TMT 6'));
    expect(onFilterChange).toHaveBeenCalledWith({
      minPrice: '3000',
      maxPrice: '9000',
    });

    onFilterChange.mockClear();
    await renderSidebar(
      {
        minPrice: '3000',
        maxPrice: '9000',
        options: {
          total: 1,
          relaxations: {},
          colorCounts: {},
          brandCounts: {},
          price,
        },
      },
      onFilterChange,
    );
    const ticked = screen
      .getAllByLabelText('3 000 – 9 000 TMT 6')
      .find((box) => (box as HTMLInputElement).checked) as HTMLElement;
    fireEvent.click(ticked);
    expect(onFilterChange).toHaveBeenCalledWith({ minPrice: '', maxPrice: '' });
  });

  it('hints the real price range in the inputs', async () => {
    await renderSidebar({
      options: {
        total: 1,
        relaxations: {},
        colorCounts: {},
        brandCounts: {},
        price,
      },
    });

    expect(screen.getByPlaceholderText('1200')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('24000')).toBeInTheDocument();
  });

  it('applies a typed price on Enter, not on every keystroke', async () => {
    const onFilterChange = vi.fn();
    await renderSidebar(
      {
        options: {
          total: 1,
          relaxations: {},
          colorCounts: {},
          brandCounts: {},
          price,
        },
      },
      onFilterChange,
    );
    const min = screen.getByPlaceholderText('1200');

    fireEvent.change(min, { target: { value: '25a00' } });
    expect(onFilterChange).not.toHaveBeenCalled();

    fireEvent.keyDown(min, { key: 'Enter' });
    expect(onFilterChange).toHaveBeenCalledWith({
      minPrice: '2500',
      maxPrice: '',
    });
  });

  it('applies a typed price when the field loses focus', async () => {
    const onFilterChange = vi.fn();
    await renderSidebar(
      {
        options: {
          total: 1,
          relaxations: {},
          colorCounts: {},
          brandCounts: {},
          price,
        },
      },
      onFilterChange,
    );
    const max = screen.getByPlaceholderText('24000');

    fireEvent.change(max, { target: { value: '8000' } });
    fireEvent.blur(max);
    expect(onFilterChange).toHaveBeenCalledWith({
      minPrice: '',
      maxPrice: '8000',
    });
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
