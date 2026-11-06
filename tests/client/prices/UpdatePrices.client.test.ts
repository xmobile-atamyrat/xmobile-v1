// @vitest-environment jsdom

import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import UpdatePrices from '@/pages/product/update-prices/index.page';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../helpers/renderWithProviders';

vi.mock('@/pages/lib/UserContext', () => ({ useUserContext: vi.fn() }));
vi.mock('@/pages/lib/fetch', () => ({ useFetchWithCreds: vi.fn() }));
vi.mock('@/pages/lib/CategoryContext', () => ({
  useCategoryContext: vi.fn(),
}));
vi.mock('@/pages/components/Layout', () => ({
  default: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/pages/components/Appbar', async () => {
  const { createElement: h } = await import('react');
  return {
    SearchBar: ({
      handleSearch,
      searchKeyword,
      setSearchKeyword,
    }: {
      handleSearch: (keyword: string) => void;
      searchKeyword: string;
      setSearchKeyword: (keyword: string) => void;
    }) =>
      h('input', {
        'aria-label': 'search',
        value: searchKeyword,
        onChange: (e: { target: { value: string } }) => {
          setSearchKeyword(e.target.value);
          handleSearch(e.target.value);
        },
      }),
  };
});

const price = (id: string, name: string, categoryId: string) => ({
  id,
  name,
  price: '10',
  priceInTmt: '200',
  displayPriceTmt: '200',
  categoryId,
  productId: null as string | null,
  dollarRateId: 1,
  outOfStockAt: null as string | null,
  updatedAt: '2026-01-01T00:00:00Z',
});

const prices = [
  price('p1', 'iPhone', 'phones'),
  price('p2', 'Cable', 'accessories'),
];

const rates = [
  { id: 1, name: 'Manat', rate: 20, currency: 'TMT', isDefault: true },
  { id: 2, name: 'Bazar', rate: 25, currency: 'TMT', isDefault: false },
];

const categories = [
  { id: 'phones', name: 'Phones', successorCategories: [] as never[] },
  {
    id: 'accessories',
    name: 'Accessories',
    successorCategories: [] as never[],
  },
];

const fetchMock = vi.fn();

const priceReads = (): string[] =>
  fetchMock.mock.calls
    .map(([request]) => request)
    .filter(
      ({ path, method }) =>
        method === 'GET' &&
        path.startsWith('/api/prices') &&
        !path.startsWith('/api/prices/rate'),
    )
    .map(({ path }) => path);

const sentWith = (method: string) =>
  fetchMock.mock.calls.find(([request]) => request.method === method)?.[0];

const renderPage = async () => {
  const view = renderWithProviders(createElement(UpdatePrices));
  await screen.findByText('iPhone');
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([{ path }]) => path === '/api/prices/rate'),
    ).toBe(true),
  );
  return view;
};

// These Selects carry a visual InputLabel but no labelId, so they have no
// accessible name to query by.
const selectLabelled = (label: string, scope: HTMLElement = document.body) =>
  within(
    within(scope).getByText(label, { selector: 'label' })
      .parentElement as HTMLElement,
  ).getByRole('combobox');

const filterByCategory = async (name: string) => {
  const user = userEvent.setup();
  await user.click(selectLabelled('Category'));
  await user.click(within(screen.getByRole('listbox')).getByText(name));
};

const search = async (keyword: string) => {
  await userEvent.setup().type(screen.getByLabelText('search'), keyword);
  await waitFor(() => expect(screen.queryByText('Cable')).toBeNull());
};

const fillAddDialog = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Add Price' }));
  const dialog = screen.getByRole('dialog');
  await user.type(
    within(dialog).getByPlaceholderText('Product Name'),
    'Charger',
  );
  await user.type(within(dialog).getByPlaceholderText('Price in dollars'), '5');
  return dialog;
};

// Mounts the whole page, which is slow to cold-start beside the rest of the suite.
describe('update-prices filters', { timeout: 20_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUserContext).mockReturnValue({
      user: { id: 'me', grade: 'ADMIN' } as never,
      setUser: vi.fn(),
      accessToken: 'token',
      setAccessToken: vi.fn(),
      isLoading: false,
    });
    vi.mocked(useCategoryContext).mockReturnValue({ categories } as never);
    vi.mocked(useFetchWithCreds).mockReturnValue(fetchMock as never);
    fetchMock.mockImplementation(async ({ path, method, body }) => {
      if (path === '/api/prices/rate' && method === 'GET') {
        return { success: true, data: rates };
      }
      if (method === 'POST') {
        return {
          success: true,
          data: { ...price('p3', body.name, 'accessories'), ...body },
        };
      }
      if (method === 'GET') {
        const keyword =
          new URL(path, 'http://test').searchParams.get('searchKeyword') ?? '';
        return {
          success: true,
          data: prices.filter(({ name }) =>
            name.toLowerCase().includes(keyword.toLowerCase()),
          ),
        };
      }
      return { success: true };
    });
  });

  it('keeps the category filter after adding a price', async () => {
    const user = userEvent.setup();
    await renderPage();
    await filterByCategory('Phones');
    expect(screen.queryByText('Cable')).toBeNull();

    const dialog = await fillAddDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(selectLabelled('Category').textContent).toBe('Phones');
    expect(screen.queryByText('Cable')).toBeNull();
    expect(screen.getByText('iPhone')).toBeTruthy();
  });

  it('creates the price on the rate picked in the dialog', async () => {
    const user = userEvent.setup();
    await renderPage();

    const dialog = await fillAddDialog();
    await user.click(selectLabelled('Rate', dialog));
    await user.click(
      within(screen.getByRole('listbox')).getByText('Bazar (25)'),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(sentWith('POST')?.body).toMatchObject({
        name: 'Charger',
        price: '5',
        priceInTmt: '125',
        dollarRateId: 2,
      }),
    );
  });

  it('keeps the filter and the search through the table save', async () => {
    const user = userEvent.setup();
    await renderPage();
    await filterByCategory('Phones');
    await search('iph');
    const readsBeforeSave = priceReads().length;

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sentWith('PUT')).toBeDefined());
    expect(priceReads()).toHaveLength(readsBeforeSave);
    expect(selectLabelled('Category').textContent).toBe('Phones');
    expect(screen.queryByText('Cable')).toBeNull();
  });

  it('keeps the search when saving a rate re-reads the table', async () => {
    const user = userEvent.setup();
    await renderPage();
    await search('iph');

    await user.click(
      screen.getByTestId('CheckCircleOutlineIcon').closest('button')!,
    );
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }),
    );

    await waitFor(() => expect(sentWith('PUT')).toBeDefined());
    await waitFor(() =>
      expect(priceReads().at(-1)).toBe('/api/prices?searchKeyword=iph'),
    );
    expect(screen.queryByText('Cable')).toBeNull();
  });

  it('files a new price under the filtered category so it stays visible', async () => {
    const user = userEvent.setup();
    await renderPage();
    await filterByCategory('Phones');

    const dialog = await fillAddDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Charger')).toBeTruthy();
    expect(sentWith('POST')?.body.categoryId).toBe('phones');
  });

  it('does not take a category from the no-category filter', async () => {
    const user = userEvent.setup();
    await renderPage();
    await filterByCategory('No category');

    const dialog = await fillAddDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(sentWith('POST')).toBeDefined());
    expect(sentWith('POST')?.body.categoryId).toBeNull();
  });

  it('keeps an out-of-stock mark on screen and in the filter after saving', async () => {
    const user = userEvent.setup();
    await renderPage();
    await search('iph');

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull(),
    );
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
      true,
    );

    await user.click(screen.getByRole('button', { name: 'Out of stock only' }));
    expect(screen.getByText('iPhone')).toBeTruthy();
  });

  it('leaves stamping outOfStockAt to the server', async () => {
    const user = userEvent.setup();
    await renderPage();
    await search('iph');

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sentWith('PUT')).toBeDefined());
    expect(sentWith('PUT')?.body.pricePairs).toEqual([
      { id: 'p1', isOutOfStock: true },
    ]);
  });

  it('does not reload the table when the access token rotates', async () => {
    const { rerender } = await renderPage();
    await search('iph');
    const readsBeforeRotation = priceReads().length;

    vi.mocked(useUserContext).mockReturnValue({
      user: { id: 'me', grade: 'ADMIN' } as never,
      setUser: vi.fn(),
      accessToken: 'rotated',
      setAccessToken: vi.fn(),
      isLoading: false,
    });
    rerender(createElement(UpdatePrices));

    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    expect(priceReads()).toHaveLength(readsBeforeRotation);
    expect(screen.queryByText('Cable')).toBeNull();
  });
});
