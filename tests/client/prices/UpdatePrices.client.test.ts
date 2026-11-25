// @vitest-environment jsdom

import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import UpdatePrices from '@/pages/product/update-prices/index.page';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) =>
  new Date(Date.now() - days * DAY_MS - 60_000).toISOString();

const price = (
  id: string,
  name: string,
  categoryId: string,
  checkedDaysAgo = 5,
) => ({
  id,
  name,
  price: '10',
  priceInTmt: '200',
  displayPriceTmt: '200',
  salePriceTmt: null as string | null,
  categoryId,
  productId: null as string | null,
  dollarRateId: 1,
  outOfStockAt: null as string | null,
  updatedAt: '2026-01-01T00:00:00Z',
  priceCheckedAt: daysAgo(checkedDaysAgo),
});

const prices = [
  price('p1', 'iPhone', 'phones', 100),
  price('p2', 'Cable', 'accessories', 5),
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

// The page has two Save buttons: one on the exchange-rate card and one on the
// bar that appears once the table has unsaved edits. This finds the bar's.
const saveChangesButton = () =>
  within(screen.getByText(/unsaved changes/).parentElement!).getByRole(
    'button',
    { name: 'Save' },
  );

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
    await user.click(saveChangesButton());

    await waitFor(() => expect(sentWith('PUT')).toBeDefined());
    expect(priceReads()).toHaveLength(readsBeforeSave);
    expect(selectLabelled('Category').textContent).toBe('Phones');
    expect(screen.queryByText('Cable')).toBeNull();
  });

  it('keeps the search when saving a rate re-reads the table', async () => {
    const user = userEvent.setup();
    await renderPage();
    await search('iph');

    // The rate editor only opens once a rate chip is picked.
    await user.click(screen.getByRole('button', { name: 'Manat · 20' }));

    // The rate's Save stays disabled until the rate actually changes.
    const rateSave = screen
      .getByTestId('CheckCircleOutlineIcon')
      .closest('button')!;
    expect(rateSave).toBeDisabled();
    await user.clear(screen.getByRole('spinbutton'));
    await user.type(screen.getByRole('spinbutton'), '21');
    expect(rateSave).toBeEnabled();

    await user.click(rateSave);
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
    await user.click(saveChangesButton());

    // The unsaved-changes bar goes away once the save has gone through.
    await waitFor(() =>
      expect(screen.queryByText(/unsaved changes/)).toBeNull(),
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
    await user.click(saveChangesButton());

    await waitFor(() => expect(sentWith('PUT')).toBeDefined());
    expect(sentWith('PUT')?.body.pricePairs).toEqual([
      { id: 'p1', isOutOfStock: true },
    ]);
  });

  it('drops the unsaved edit of a deleted price from the next save', async () => {
    const user = userEvent.setup();
    await renderPage();

    const [first, second] = screen.getAllByRole('checkbox');
    await user.click(first);
    await user.click(second);
    await user.click(screen.getAllByTestId('DeleteIcon')[0].closest('button')!);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(saveChangesButton());

    await waitFor(() => expect(sentWith('PUT')).toBeDefined());
    expect(sentWith('PUT')?.body.pricePairs).toEqual([
      { id: 'p2', isOutOfStock: true },
    ]);
  });

  it('drops a change that is reverted by hand', async () => {
    const user = userEvent.setup();
    await renderPage();
    const [first, second] = screen.getAllByRole('checkbox');

    await user.click(first);
    await user.click(second);
    expect(screen.getByText(/^2 unsaved changes/)).toBeTruthy();

    await user.click(first);
    expect(screen.getByText(/^1 unsaved changes/)).toBeTruthy();

    await user.click(second);
    expect(screen.queryByText(/unsaved changes/)).toBeNull();
  });

  it('restores the linked prices when a dollar price is typed back', async () => {
    await renderPage();
    const dollars = screen.getAllByText('10')[0];

    dollars.textContent = '12';
    fireEvent.input(dollars);
    await screen.findByText(/^1 unsaved changes/);
    expect(screen.getAllByText('240')).toHaveLength(2);

    dollars.textContent = '10';
    fireEvent.input(dollars);
    await waitFor(() =>
      expect(screen.queryByText(/unsaved changes/)).toBeNull(),
    );
    expect(screen.queryByText('240')).toBeNull();
    // Manat and display, on both rows.
    expect(screen.getAllByText('200')).toHaveLength(4);
  });

  it('shows the days since the price was checked, oldest first', async () => {
    await renderPage();

    expect(screen.getByText('100 d')).toBeTruthy();
    expect(screen.getByText('5 d')).toBeTruthy();
    const names = screen
      .getAllByText(/^(iPhone|Cable)$/)
      .map((node) => node.textContent);
    expect(names).toEqual(['iPhone', 'Cable']);
    expect(selectLabelled('Sort by').textContent).toBe('Longest not edited');
  });

  it('tints an old row and leaves a recent one alone', async () => {
    await renderPage();

    const rowOf = (text: string) =>
      screen.getByText(text).closest('tr') as HTMLElement;
    expect(getComputedStyle(rowOf('100 d')).backgroundColor).toMatch(
      /rgba\(\d+, \d+, \d+, 0\.12\)/,
    );
    expect(getComputedStyle(rowOf('5 d')).backgroundColor).toBe(
      'rgba(0, 0, 0, 0)',
    );
  });

  it('marks a row as checked as a pending edit and saves it with Save', async () => {
    const user = userEvent.setup();
    await renderPage();
    const refresh = () =>
      screen.getAllByTestId('RefreshIcon')[0].closest('button')!;

    await user.click(refresh());
    expect(screen.getByText(/^1 unsaved changes/)).toBeTruthy();
    // No request yet, and the row neither moved nor kept its warning.
    expect(sentWith('POST')).toBeUndefined();
    expect(sentWith('PUT')).toBeUndefined();
    expect(screen.getByText('0 d')).toBeTruthy();
    expect(screen.queryByText('100 d')).toBeNull();
    const names = screen
      .getAllByText(/^(iPhone|Cable)$/)
      .map((node) => node.textContent);
    expect(names).toEqual(['iPhone', 'Cable']);

    // A second click toggles it back off.
    await user.click(refresh());
    expect(screen.queryByText(/unsaved changes/)).toBeNull();
    expect(screen.getByText('100 d')).toBeTruthy();

    await user.click(refresh());
    await user.click(screen.getAllByRole('checkbox')[1]);
    await user.click(saveChangesButton());
    await waitFor(() => expect(sentWith('PUT')).toBeDefined());
    expect(sentWith('PUT')?.body.pricePairs).toEqual([
      { id: 'p1', markChecked: true },
      { id: 'p2', isOutOfStock: true },
    ]);
    // After saving, Cable is sold out, so it sinks to the bottom even though
    // its price is older than iPhone's freshly checked one.
    await waitFor(() => {
      expect(screen.getByText('Prices updated successfully!')).toBeTruthy();
    });
    const after = screen
      .getAllByText(/^(iPhone|Cable)$/)
      .map((node) => node.textContent);
    expect(after).toEqual(['iPhone', 'Cable']);
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

describe('update-prices sale price', { timeout: 20_000 }, () => {
  // iPhone has no sale; Cable is already on sale.
  const saleRows = [prices[0], { ...prices[1], salePriceTmt: '150' }];
  let putResponse: { success: boolean; message?: string };

  beforeEach(() => {
    vi.clearAllMocks();
    putResponse = { success: true };
    vi.mocked(useUserContext).mockReturnValue({
      user: { id: 'me', grade: 'ADMIN' } as never,
      setUser: vi.fn(),
      accessToken: 'token',
      setAccessToken: vi.fn(),
      isLoading: false,
    });
    vi.mocked(useCategoryContext).mockReturnValue({ categories } as never);
    vi.mocked(useFetchWithCreds).mockReturnValue(fetchMock as never);
    fetchMock.mockImplementation(async ({ path, method }) => {
      if (method === 'PUT') return putResponse;
      if (path === '/api/prices/rate') return { success: true, data: rates };
      return { success: true, data: saleRows };
    });
  });

  // The editable boxes of a row, in column order.
  const boxesOf = (name: string) => {
    const [, dollars, , display, sale] = Array.from(
      screen
        .getByText(name)
        .closest('tr')!
        .querySelectorAll<HTMLElement>('[contenteditable]'),
    );
    return { dollars, display, sale };
  };

  // Types over a box and leaves it, which records the edit right away.
  const typeInto = (box: HTMLElement, text: string) => {
    box.textContent = text;
    fireEvent.input(box);
    fireEvent.blur(box);
  };

  const save = () => userEvent.setup().click(saveChangesButton());

  it('sends a typed sale price on its own and shows the discount', async () => {
    await renderPage();

    typeInto(boxesOf('iPhone').sale, '150');

    expect(boxesOf('iPhone').sale.textContent).toBe('150');
    // One chip for the typed sale, one for the stored one.
    expect(screen.getAllByText('-25%')).toHaveLength(2);
    await save();
    await waitFor(() => expect(sentWith('PUT')).toBeDefined());
    expect(sentWith('PUT')?.body.pricePairs).toEqual([
      { id: 'p1', salePriceTmt: '150' },
    ]);
  });

  it('recomputes the discount from a pending display price', async () => {
    await renderPage();

    typeInto(boxesOf('Cable').display, '300');

    expect(screen.getByText('-50%')).toBeTruthy();
  });

  it('does not resend a stored sale when another cell is edited', async () => {
    await renderPage();

    typeInto(boxesOf('Cable').display, '300');
    await save();

    await waitFor(() => expect(sentWith('PUT')).toBeDefined());
    expect(sentWith('PUT')?.body.pricePairs).toEqual([
      { id: 'p2', displayPriceTmt: '300' },
    ]);
  });

  it('sends null for an emptied sale cell and keeps it empty', async () => {
    await renderPage();

    typeInto(boxesOf('Cable').sale, '');

    expect(boxesOf('Cable').sale.textContent).toBe('');
    expect(screen.queryByText('-25%')).toBeNull();
    await save();
    await waitFor(() => expect(sentWith('PUT')).toBeDefined());
    expect(sentWith('PUT')?.body.pricePairs).toEqual([
      { id: 'p2', salePriceTmt: null },
    ]);
  });

  it('drops a sale price typed back to the saved one', async () => {
    await renderPage();

    typeInto(boxesOf('Cable').sale, '120');
    expect(screen.getByText(/^1 unsaved changes/)).toBeTruthy();
    typeInto(boxesOf('Cable').sale, '150');

    expect(screen.queryByText(/unsaved changes/)).toBeNull();
  });

  it('restores the saved sale price on discard', async () => {
    await renderPage();

    typeInto(boxesOf('Cable').sale, '120');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Discard' }));

    expect(boxesOf('Cable').sale.textContent).toBe('150');
  });

  it('flags an invalid sale price and refuses to save it', async () => {
    await renderPage();

    typeInto(boxesOf('iPhone').sale, '200');

    expect(screen.getByTestId('ErrorOutlineIcon')).toBeTruthy();
    await save();
    expect(
      await screen.findByText(
        'Sale price must be above 0 and lower than the normal price',
      ),
    ).toBeTruthy();
    expect(sentWith('PUT')).toBeUndefined();
    expect(screen.getByText(/^1 unsaved changes/)).toBeTruthy();
  });

  it('translates a refused sale price and keeps the edit', async () => {
    putResponse = { success: false, message: 'salePriceInvalid' };
    await renderPage();

    typeInto(boxesOf('iPhone').sale, '150');
    await save();

    expect(
      await screen.findByText(
        'Sale price must be above 0 and lower than the normal price',
      ),
    ).toBeTruthy();
    expect(screen.getByText(/^1 unsaved changes/)).toBeTruthy();
    expect(boxesOf('iPhone').sale.textContent).toBe('150');
  });

  it('does not turn the sale price into the display price on a rate revert', async () => {
    const user = userEvent.setup();
    await renderPage();
    // A rate cell is plain text until clicked.
    const pickRate = async (current: string, next: string) => {
      const row = screen.getByText('Cable').closest('tr')!;
      await user.click(within(row).getByText(current));
      await user.click(within(screen.getByRole('listbox')).getByText(next));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    };

    await pickRate('Manat (20)', 'Bazar (25)');
    expect(boxesOf('Cable').display.textContent).toBe('250');
    await pickRate('Bazar (25)', 'Manat (20)');

    expect(boxesOf('Cable').display.textContent).toBe('200');
    expect(screen.queryByText(/unsaved changes/)).toBeNull();
  });

  it('filters to the prices on sale until the filters are cleared', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: 'On sale' }));
    expect(screen.queryByText('iPhone')).toBeNull();
    expect(screen.getByText('Cable')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(await screen.findByText('iPhone')).toBeTruthy();
  });
});
