// @vitest-environment jsdom

import PricesPanel from '@/pages/procurement/components/PricesPanel';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  ProcurementContextValue,
  useProcurement,
} from '@/pages/procurement/lib/ProcurementContext';
import { HistoryPrice } from '@/pages/procurement/lib/types';
import { priceHash } from '@/pages/procurement/lib/utils';
import { ProcurementProduct, ProcurementSupplier } from '@prisma/client';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../helpers/renderWithProviders';

vi.mock('@/pages/lib/UserContext', () => ({ useUserContext: vi.fn() }));
vi.mock('@/pages/lib/fetch', () => ({ useFetchWithCreds: vi.fn() }));
vi.mock('@/pages/procurement/lib/ProcurementContext', () => ({
  useProcurement: vi.fn(),
}));
vi.mock('@/pages/lib/PlatformContext', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  usePlatform: vi.fn(),
}));

const orderId = 'o1';
const products = [
  { id: 'p1', name: 'iPhone 15 Pro Max 256GB Natural Titanium' },
  { id: 'p2', name: 'Galaxy S24 Ultra' },
  { id: 'p3', name: 'Pixel 9' },
] as ProcurementProduct[];
const suppliers = [
  { id: 's1', name: 'Store A' },
  { id: 's2', name: 'Store B' },
] as ProcurementSupplier[];
const key = (productId: string, supplierId: string) =>
  priceHash({ orderId, productId, supplierId });

// p1 fully priced (s1 cheapest/green), p2 missing s2, p3 not ordered.
const initialPrices: HistoryPrice = {
  [key('p1', 's1')]: { value: 10, color: 'green' },
  [key('p1', 's2')]: { value: 12, color: 'orange' },
  [key('p2', 's1')]: { value: 5, color: 'white' },
};
const quantities = { p1: 2, p2: 1, p3: 0 };

const fetchMock = vi.fn();
const notify = vi.fn();
let latestPrices: HistoryPrice;

function Harness() {
  const [prices, setPrices] = useState(initialPrices);
  latestPrices = prices;
  vi.mocked(useProcurement).mockReturnValue({
    selectedHistory: { id: orderId, currency: 'USD' },
    selectedProducts: products,
    selectedSuppliers: suppliers,
    hashedQuantities: quantities,
    prices,
    setPrices,
    notify,
  } as unknown as ProcurementContextValue);
  return createElement(PricesPanel);
}

const render = () => renderWithProviders(createElement(Harness));

const priceField = (supplierName: string, productName: string) =>
  screen.getByRole('textbox', {
    name: `${supplierName}, ${productName}`,
  }) as HTMLInputElement;

const putCalls = () =>
  fetchMock.mock.calls
    .map(([arg]) => arg)
    .filter(
      (arg) =>
        arg.method === 'PUT' && arg.path === '/api/procurement/order/prices',
    );

describe('PricesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePlatform).mockReturnValue('web');
    vi.mocked(useUserContext).mockReturnValue({
      user: { id: 'me' } as never,
      setUser: vi.fn(),
      accessToken: 'token',
      setAccessToken: vi.fn(),
      isLoading: false,
    });
    vi.mocked(useFetchWithCreds).mockReturnValue(fetchMock as never);
    fetchMock.mockResolvedValue({ success: true });
  });

  it('saves two cells edited in quick succession (debounce is per cell)', async () => {
    render();
    fireEvent.change(priceField('Store A', 'Galaxy S24 Ultra'), {
      target: { value: '5,5' },
    });
    fireEvent.change(priceField('Store B', 'Galaxy S24 Ultra'), {
      target: { value: '7.25' },
    });

    // Raw text is kept while typing; the parsed number is in state at once.
    expect(priceField('Store A', 'Galaxy S24 Ultra').value).toBe('5,5');
    expect(latestPrices[key('p2', 's1')].value).toBe(5.5);
    expect(putCalls()).toHaveLength(0);

    await waitFor(() => expect(putCalls().length).toBeGreaterThan(0));
    const saved = putCalls().flatMap(({ body }) => body);
    expect(saved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          orderId,
          productId: 'p2',
          supplierId: 's1',
          price: 5.5,
          color: 'white',
        }),
        expect.objectContaining({
          productId: 'p2',
          supplierId: 's2',
          price: 7.25,
        }),
      ]),
    );
    // No "Success" toast per keystroke; only failures toast.
    expect(notify).not.toHaveBeenCalled();
  });

  it('clears the mark of a cell whose price is edited', async () => {
    render();
    const cell = priceField('Store A', products[0].name).closest('td');
    expect(cell?.getAttribute('data-mark')).toBe('green');
    fireEvent.change(priceField('Store A', products[0].name), {
      target: { value: '9' },
    });
    expect(cell?.getAttribute('data-mark')).toBe('white');
    await waitFor(() => expect(putCalls()).toHaveLength(1));
  });

  it('changes a mark optimistically and reverts when the save fails', async () => {
    let resolveSave: (value: unknown) => void = () => {};
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    render();
    const cell = priceField('Store A', 'Galaxy S24 Ultra').closest('td');
    expect(cell?.getAttribute('data-mark')).toBe('white');

    await userEvent.click(
      within(cell as HTMLElement).getByRole('button', {
        name: 'Price mark: No mark',
      }),
    );
    // Labelled options, not bare swatches.
    await userEvent.click(screen.getByRole('radio', { name: /Buy here/ }));

    expect(cell?.getAttribute('data-mark')).toBe('green');
    expect(putCalls()[0].body).toEqual([
      { orderId, productId: 'p2', supplierId: 's1', color: 'green' },
    ]);

    await act(async () => {
      resolveSave({ success: false, message: 'nope' });
    });
    await waitFor(() => expect(cell?.getAttribute('data-mark')).toBe('white'));
    expect(notify).toHaveBeenCalledWith('failedToUpdateQuantity', 'error');
  });

  it('shows the filled count and the chosen total in the order currency', () => {
    render();
    const summary = screen.getByTestId('prices-summary');
    // 4 cells on ordered products (p1, p2), 3 filled; p3 has quantity 0.
    expect(summary.textContent).toContain('3 / 4');
    // Green: p1 @ Store A = 2 x 10.
    expect(summary.textContent).toContain('20 USD');
  });

  it('filters to products with missing prices and keeps an edited one visible', async () => {
    render();
    await userEvent.click(
      screen.getByRole('button', { name: /Missing prices/ }),
    );

    const rows = screen.getAllByTestId('price-product-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Galaxy S24 Ultra');

    fireEvent.change(priceField('Store B', 'Galaxy S24 Ultra'), {
      target: { value: '6' },
    });
    // Now nothing is missing, but the row being filled doesn't vanish.
    expect(screen.getAllByTestId('price-product-row')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: /^All/ }));
    await userEvent.click(
      screen.getByRole('button', { name: /Missing prices/ }),
    );
    expect(screen.queryAllByTestId('price-product-row')).toHaveLength(0);
    expect(screen.getByText('All prices are filled in')).toBeTruthy();
  });

  it('on phones shows a card per product, collapses unordered ones, and opens the mark sheet', async () => {
    vi.mocked(usePlatform).mockReturnValue('mobile');
    render();

    const cards = screen.getAllByTestId('price-product-card');
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByText('qty 2')).toBeTruthy();
    expect(within(cards[0]).getByText('Buy here')).toBeTruthy();

    // Not ordered: no price fields until expanded.
    expect(
      within(cards[2]).getByText('Not ordered: quantity is 0'),
    ).toBeTruthy();
    expect(within(cards[2]).queryAllByRole('textbox')).toHaveLength(0);
    await userEvent.click(
      within(cards[2]).getByRole('button', { expanded: false }),
    );
    expect(within(cards[2]).getAllByRole('textbox')).toHaveLength(2);

    const field = priceField('Store A', products[0].name);
    expect(field.getAttribute('inputmode')).toBe('decimal');

    await userEvent.click(
      within(cards[0]).getAllByRole('button', { name: /Price mark/ })[0],
    );
    const sheet = await screen.findByTestId('price-mark-sheet');
    expect(within(sheet).getByText('Most expensive')).toBeTruthy();
    expect(within(sheet).getByText('No mark')).toBeTruthy();
    expect(
      within(sheet)
        .getByRole('radio', { name: /Buy here/ })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });
});
