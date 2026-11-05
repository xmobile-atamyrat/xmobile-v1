// @vitest-environment jsdom

import { useDollarRateContext } from '@/pages/lib/DollarRateContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import OrdersSheet from '@/pages/procurement/components/OrdersSheet';
import {
  suggestOrderName,
  formatOrderDate,
} from '@/pages/procurement/components/orders/orderUtils';
import {
  ProcurementProvider,
  useProcurement,
} from '@/pages/procurement/lib/ProcurementContext';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../helpers/renderWithProviders';

vi.mock('@/pages/lib/UserContext', () => ({ useUserContext: vi.fn() }));
vi.mock('@/pages/lib/DollarRateContext', () => ({
  useDollarRateContext: vi.fn(),
}));
vi.mock('@/pages/lib/fetch', () => ({ useFetchWithCreds: vi.fn() }));

type Order = {
  id: string;
  name: string;
  currency: 'USD' | 'TMT';
  dollarRateId: null;
  createdAt: string;
  updatedAt: string;
};

const mkOrder = (
  id: string,
  day: number,
  currency: Order['currency'],
): Order => ({
  id,
  name: `Order ${id}`,
  currency,
  dollarRateId: null,
  createdAt: `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`,
  updatedAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`,
});

let db: Order[];
const fetchMock = vi.fn();

/** A tiny in-memory /api/procurement/order backend. */
function installBackend() {
  fetchMock.mockImplementation(async ({ path, method, body }) => {
    if (method === 'GET' && path.includes('?id=')) {
      const id = path.split('?id=')[1];
      const found = db.find((o) => o.id === id);
      return {
        success: true,
        data: {
          ...found,
          products: [{ product: { id: `prod-${id}`, name: `P of ${id}` } }],
          suppliers: [],
          prices: [],
          productQuantities: [],
        },
      };
    }
    if (method === 'GET') {
      return {
        success: true,
        data: [...db].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      };
    }
    if (method === 'PUT') {
      const found = db.find((o) => o.id === body.id)!;
      Object.assign(found, { name: body.name ?? found.name });
      return { success: true, data: { ...found } };
    }
    if (method === 'DELETE') {
      const found = db.find((o) => o.id === body.id)!;
      db = db.filter((o) => o.id !== body.id);
      return { success: true, data: found };
    }
    if (method === 'POST') {
      const created = {
        ...mkOrder('new', 30, 'TMT'),
        name: body.name,
      };
      db.push(created);
      return { success: true, data: created };
    }
    return { success: false, message: 'unexpected' };
  });
}

/** Stand-in for the page header: opens the sheets, shows the open order. */
function Probe() {
  const {
    selectedHistory,
    selectedProducts,
    setOrdersSheetOpen,
    setNewOrderDialogOpen,
  } = useProcurement();
  return createElement(
    'div',
    null,
    createElement(
      'span',
      { 'data-testid': 'open-order' },
      selectedHistory ? selectedHistory.name : 'none',
    ),
    createElement(
      'span',
      { 'data-testid': 'open-products' },
      String(selectedProducts.length),
    ),
    createElement(
      'button',
      { type: 'button', onClick: () => setOrdersSheetOpen(true) },
      'open-orders',
    ),
    createElement(
      'button',
      { type: 'button', onClick: () => setNewOrderDialogOpen(true) },
      'new-order',
    ),
  );
}

async function renderSheet() {
  renderWithProviders(
    createElement(
      ProcurementProvider,
      null,
      createElement(Probe),
      createElement(OrdersSheet),
    ),
  );
  await waitFor(() =>
    expect(screen.getByTestId('open-order').textContent).toBe('Order b'),
  );
}

const cards = () => screen.getAllByTestId('procurement-order-card');
const cardFor = (name: string) =>
  cards().find((card) => within(card).queryByText(name)) as HTMLElement;

describe('OrdersSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db = [mkOrder('a', 1, 'USD'), mkOrder('b', 5, 'TMT')];
    installBackend();
    mockRouter.setCurrentUrl('/procurement?tab=prices');
    vi.mocked(useUserContext).mockReturnValue({
      user: { id: 'me', grade: 'SUPERUSER' } as never,
      setUser: vi.fn(),
      accessToken: 'token',
      setAccessToken: vi.fn(),
      isLoading: false,
    });
    vi.mocked(useDollarRateContext).mockReturnValue({
      rates: [],
      setRates: vi.fn(),
    } as never);
    vi.mocked(useFetchWithCreds).mockReturnValue(fetchMock as never);
  });

  it('lists orders newest first and marks the open one', async () => {
    await renderSheet();
    await userEvent.click(screen.getByText('open-orders'));

    const [first, second] = cards();
    expect(within(first).getByText('Order b')).toBeTruthy();
    expect(within(second).getByText('Order a')).toBeTruthy();
    expect(first.dataset.active).toBe('true');
    expect(within(first).getByText('Open')).toBeTruthy();
    expect(within(first).getByText('TMT')).toBeTruthy();
    expect(second.dataset.active).toBeUndefined();
    expect(within(second).queryByText('Open')).toBeNull();
    expect(
      within(second).getByText(
        `Created ${formatOrderDate('2026-10-01T10:00:00.000Z')}`,
      ),
    ).toBeTruthy();
    // Only 2 orders: no search field.
    expect(screen.queryByLabelText('Search orders')).toBeNull();
  });

  it('selecting a card opens that order and closes the sheet', async () => {
    await renderSheet();
    await userEvent.click(screen.getByText('open-orders'));
    await userEvent.click(within(cardFor('Order a')).getByText('Order a'));

    await waitFor(() =>
      expect(screen.getByTestId('open-order').textContent).toBe('Order a'),
    );
    await waitFor(() =>
      expect(screen.queryByTestId('procurement-orders-sheet')).toBeNull(),
    );
    // `?order=` is owned by the page shell (index.page.tsx), not the sheet.
    expect(mockRouter.query).toEqual({ tab: 'prices' });
  });

  it('renames an order in the list and in the open order', async () => {
    await renderSheet();
    await userEvent.click(screen.getByText('open-orders'));
    await userEvent.click(
      within(cardFor('Order b')).getByLabelText('Order actions'),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    const field = screen.getByLabelText('Rename order');
    expect((field as HTMLInputElement).value).toBe('Order b');
    await userEvent.clear(field);
    await userEvent.type(field, 'Week 45{Enter}');

    await waitFor(() =>
      expect(screen.getByTestId('open-order').textContent).toBe('Week 45'),
    );
    expect(within(cards()[0]).getByText('Week 45')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PUT',
        body: expect.objectContaining({ id: 'b', name: 'Week 45' }),
      }),
    );
  });

  it('deleting the open order opens the next one', async () => {
    await renderSheet();
    await userEvent.click(screen.getByText('open-orders'));
    await userEvent.click(
      within(cardFor('Order b')).getByLabelText('Order actions'),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(screen.getByTestId('open-order').textContent).toBe('Order a'),
    );
    expect(cards()).toHaveLength(1);
    expect(cards()[0].dataset.active).toBe('true');
  });

  it('deleting the last order clears the screen', async () => {
    db = [mkOrder('b', 5, 'TMT')];
    mockRouter.setCurrentUrl('/procurement?order=b');
    await renderSheet();
    await userEvent.click(screen.getByText('open-orders'));
    await userEvent.click(screen.getByLabelText('Order actions'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(screen.getByTestId('open-order').textContent).toBe('none'),
    );
    expect(screen.getByTestId('open-products').textContent).toBe('0');
    expect(screen.getByText('No orders yet')).toBeTruthy();
  });

  it('creates a new order with a date name and opens it', async () => {
    await renderSheet();
    await userEvent.click(screen.getByText('new-order'));

    const field = screen.getByLabelText('New Order') as HTMLInputElement;
    expect(field.value).toBe(suggestOrderName([]));
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(screen.getByTestId('open-order').textContent).toBe(field.value),
    );
    expect(screen.getByTestId('open-products').textContent).toBe('0');
    expect(screen.queryByLabelText('New Order')).toBeNull();

    await userEvent.click(screen.getByText('open-orders'));
    expect(cards()).toHaveLength(3);
    expect(cards()[0].dataset.active).toBe('true');
  });

  it('a failed create keeps the dialog open and the current order intact', async () => {
    await renderSheet();
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (args) =>
      args.method === 'POST' ? { success: false, message: 'boom' } : base(args),
    );
    await userEvent.click(screen.getByText('new-order'));
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(screen.getByLabelText('New Order')).toBeTruthy();
    expect(screen.getByTestId('open-order').textContent).toBe('Order b');
    expect(screen.getByTestId('open-products').textContent).toBe('1');
  });

  it('shows a search field past 10 orders and filters by name', async () => {
    db = Array.from({ length: 12 }, (_, i) =>
      mkOrder(`o${i + 1}`, i + 1, 'USD'),
    );
    db.push({ ...mkOrder('b', 20, 'TMT') });
    await renderSheet();
    await userEvent.click(screen.getByText('open-orders'));
    expect(cards()).toHaveLength(13);

    await userEvent.type(screen.getByLabelText('Search orders'), 'order o1');
    // o1, o10, o11, o12
    expect(cards()).toHaveLength(4);
    await userEvent.type(screen.getByLabelText('Search orders'), 'zzz');
    expect(screen.getByText('No orders found')).toBeTruthy();
  });
});

describe('suggestOrderName', () => {
  it('uses the date and avoids taken names', () => {
    const now = new Date(2026, 10, 2, 9);
    expect(suggestOrderName([], now)).toBe('02.11.2026');
    const taken = [{ name: '02.11.2026' }, { name: '02.11.2026 (2)' }];
    expect(suggestOrderName(taken as never, now)).toBe('02.11.2026 (3)');
  });
});
