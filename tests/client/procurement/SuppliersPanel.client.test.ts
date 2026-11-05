// @vitest-environment jsdom

import SuppliersPanel from '@/pages/procurement/components/SuppliersPanel';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  deletePricesUtil,
  editHistoryUtil,
} from '@/pages/procurement/lib/apiUtils';
import {
  ProcurementContextValue,
  useProcurement,
} from '@/pages/procurement/lib/ProcurementContext';
import { HistoryPrice } from '@/pages/procurement/lib/types';
import { priceHash } from '@/pages/procurement/lib/utils';
import { ProcurementSupplier } from '@prisma/client';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../helpers/renderWithProviders';

vi.mock('@/pages/lib/UserContext', () => ({ useUserContext: vi.fn() }));
vi.mock('@/pages/lib/fetch', () => ({ useFetchWithCreds: vi.fn() }));
vi.mock('@/pages/procurement/lib/apiUtils', () => ({
  editHistoryUtil: vi.fn(),
  deletePricesUtil: vi.fn(),
}));
vi.mock('@/pages/procurement/lib/ProcurementContext', () => ({
  useProcurement: vi.fn(),
}));

const orderId = 'o1';
const key = (productId: string, supplierId: string) =>
  priceHash({ orderId, productId, supplierId });

const supplier = (
  id: string,
  name: string,
  description: string | null = null,
) => ({ id, name, description }) as unknown as ProcurementSupplier;

const longName =
  'Ashgabat Electronics Wholesale Centre Berkararlyk Market Row 14';

const openCatalog = vi.fn();
let latestPrices: HistoryPrice;
let latestSuppliers: ProcurementSupplier[];

/** Holds suppliers/prices in real state so updates re-render the panel. */
function Harness({
  suppliers,
  prices,
}: {
  suppliers: ProcurementSupplier[];
  prices: HistoryPrice;
}) {
  const [selectedSuppliers, setSelectedSuppliers] = useState(suppliers);
  const [currPrices, setPrices] = useState(prices);
  latestPrices = currPrices;
  latestSuppliers = selectedSuppliers;
  vi.mocked(useProcurement).mockReturnValue({
    selectedHistory: { id: orderId },
    selectedSuppliers,
    setSelectedSuppliers,
    selectedProducts: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
    hashedQuantities: { p1: 2, p2: 1, p3: 0 },
    prices: currPrices,
    setPrices,
    openCatalog,
    setSnackbarMessage: vi.fn(),
    setSnackbarOpen: vi.fn(),
  } as unknown as ProcurementContextValue);
  return createElement(SuppliersPanel);
}

const render = (suppliers: ProcurementSupplier[], prices: HistoryPrice) =>
  renderWithProviders(createElement(Harness, { suppliers, prices }));

describe('SuppliersPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUserContext).mockReturnValue({
      accessToken: 'token',
    } as never);
    vi.mocked(useFetchWithCreds).mockReturnValue(vi.fn() as never);
    vi.mocked(editHistoryUtil).mockResolvedValue({ id: orderId } as never);
    vi.mocked(deletePricesUtil).mockResolvedValue(true);
  });

  it('renders each supplier with its pricing status', () => {
    render(
      [
        supplier('s1', 'Store A', 'Pays in cash only'),
        supplier('s2', longName),
      ],
      {
        [key('p1', 's1')]: { value: 10, color: 'green' },
        [key('p2', 's1')]: { value: 3.5, color: 'orange' },
        [key('p1', 's2')]: { value: 12, color: 'orange' },
      },
    );

    expect(screen.getByRole('heading', { name: /Suppliers\s*2/ })).toBeTruthy();
    const rows = screen.getAllByTestId('procurement-supplier-row');
    expect(rows).toHaveLength(2);

    expect(within(rows[0]).getByText('Store A')).toBeTruthy();
    expect(within(rows[0]).getByText('Pays in cash only')).toBeTruthy();
    expect(within(rows[0]).getByText('Priced 2 of 2')).toBeTruthy();
    expect(within(rows[0]).getByText('Cheapest for 1')).toBeTruthy();

    expect(within(rows[1]).getByText(longName)).toBeTruthy();
    expect(within(rows[1]).getByText('Priced 1 of 2')).toBeTruthy();
    expect(within(rows[1]).queryByText(/Cheapest/)).toBeNull();
  });

  it('hides "cheapest" before the order is calculated', () => {
    render([supplier('s1', 'Store A')], {
      [key('p1', 's1')]: { value: 10, color: 'white' },
    });
    expect(screen.getByText('Priced 1 of 2')).toBeTruthy();
    expect(screen.queryByText(/Cheapest/)).toBeNull();
  });

  it('opens the supplier catalog from the header button', async () => {
    render([supplier('s1', 'Store A')], {});
    await userEvent.click(
      screen.getByRole('button', { name: 'Add Suppliers' }),
    );
    expect(openCatalog).toHaveBeenCalledWith('supplier');
  });

  it('removes a supplier and its prices after confirmation', async () => {
    const prices: HistoryPrice = {
      [key('p1', 's1')]: { value: 10 },
      [key('p3', 's1')]: { value: 7 },
      [key('p1', 's2')]: { value: 11 },
    };
    const original = { ...prices };
    render([supplier('s1', 'Store A'), supplier('s2', 'Store B')], prices);

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Store A' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Store A/)).toBeTruthy();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Remove' }),
    );

    await waitFor(() =>
      expect(screen.getAllByTestId('procurement-supplier-row')).toHaveLength(1),
    );
    expect(vi.mocked(editHistoryUtil).mock.calls[0][0]).toMatchObject({
      id: orderId,
      removedSupplierIds: ['s1'],
    });
    expect(vi.mocked(deletePricesUtil).mock.calls[0][0].ids).toEqual([
      { orderId, productId: 'p1', supplierId: 's1' },
      { orderId, productId: 'p3', supplierId: 's1' },
    ]);
    expect(latestSuppliers.map(({ id }) => id)).toEqual(['s2']);
    expect(latestPrices).toEqual({ [key('p1', 's2')]: { value: 11 } });
    // The old handler deleted keys from the state object in place.
    expect(prices).toEqual(original);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('skips the price request when the supplier has no prices', async () => {
    render([supplier('s1', 'Store A')], {});
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Store A' }),
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Remove',
      }),
    );
    await waitFor(() => expect(latestSuppliers).toEqual([]));
    expect(deletePricesUtil).not.toHaveBeenCalled();
  });

  it('keeps the supplier when the order update fails', async () => {
    vi.mocked(editHistoryUtil).mockResolvedValue(undefined);
    const prices = { [key('p1', 's1')]: { value: 10 } };
    render([supplier('s1', 'Store A')], prices);
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Store A' }),
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Remove',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(deletePricesUtil).not.toHaveBeenCalled();
    expect(screen.getAllByTestId('procurement-supplier-row')).toHaveLength(1);
    expect(latestPrices).toEqual(prices);
  });

  it('shows the empty state with an add action', async () => {
    render([], {});
    expect(
      screen.getByText(/Suppliers are the stores you request prices from/),
    ).toBeTruthy();
    expect(screen.queryByTestId('procurement-supplier-row')).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: 'Add Suppliers' }),
    );
    expect(openCatalog).toHaveBeenCalledWith('supplier');
  });
});
