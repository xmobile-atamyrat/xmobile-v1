// @vitest-environment jsdom

import ProductsPanel from '@/pages/procurement/components/ProductsPanel';
import { parseQuantityInput } from '@/pages/procurement/components/products/quantity';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  ProcurementContextValue,
  useProcurement,
} from '@/pages/procurement/lib/ProcurementContext';
import { HistoryPrice } from '@/pages/procurement/lib/types';
import { priceHash } from '@/pages/procurement/lib/utils';
import {
  ProcurementOrderProductQuantity,
  ProcurementProduct,
  ProcurementSupplier,
} from '@prisma/client';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, useEffect, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../helpers/renderWithProviders';

vi.mock('@/pages/lib/UserContext', () => ({ useUserContext: vi.fn() }));
vi.mock('@/pages/lib/fetch', () => ({ useFetchWithCreds: vi.fn() }));
vi.mock('@/pages/procurement/lib/ProcurementContext', () => ({
  useProcurement: vi.fn(),
}));

const orderId = 'o1';
const product = (id: string, name: string) =>
  ({ id, name }) as unknown as ProcurementProduct;
const supplier = (id: string) =>
  ({ id, name: `Store ${id}` }) as unknown as ProcurementSupplier;
const quantity = (productId: string, value: number | null) =>
  ({
    id: `q-${productId}`,
    orderId,
    productId,
    quantity: value,
  }) as ProcurementOrderProductQuantity;

const longName = 'iPhone 15 Pro Max 256GB Natural Titanium Dual SIM';
const fetchMock = vi.fn();
const notify = vi.fn();
const openCatalog = vi.fn();
let latest: {
  products: ProcurementProduct[];
  quantities: ProcurementOrderProductQuantity[];
  hashed: Record<string, number | null>;
  prices: HistoryPrice;
};

/**
 * Real state for the bits ProductsPanel changes, wired like the provider
 * (hashedQuantities follows productQuantities), so updates re-render.
 */
function Harness({
  products,
  quantities,
  prices = {},
  suppliers = [],
}: {
  products: ProcurementProduct[];
  quantities: ProcurementOrderProductQuantity[];
  prices?: HistoryPrice;
  suppliers?: ProcurementSupplier[];
}) {
  const [selectedProducts, setSelectedProducts] = useState(products);
  const [productQuantities, setProductQuantities] = useState(quantities);
  const [hashedQuantities, setHashedQuantities] = useState<
    Record<string, number | null>
  >({});
  const [currPrices, setPrices] = useState(prices);
  useEffect(() => {
    setHashedQuantities((curr) => {
      const next = { ...curr };
      productQuantities.forEach((pq) => {
        next[pq.productId] = pq.quantity;
      });
      return next;
    });
  }, [productQuantities]);
  latest = {
    products: selectedProducts,
    quantities: productQuantities,
    hashed: hashedQuantities,
    prices: currPrices,
  };
  vi.mocked(useProcurement).mockReturnValue({
    selectedHistory: { id: orderId },
    selectedProducts,
    setSelectedProducts,
    selectedSuppliers: suppliers,
    productQuantities,
    setProductQuantities,
    hashedQuantities,
    setHashedQuantities,
    prices: currPrices,
    setPrices,
    initialLoading: false,
    openCatalog,
    notify,
    setSnackbarMessage: vi.fn(),
    setSnackbarOpen: vi.fn(),
  } as unknown as ProcurementContextValue);
  return createElement(ProductsPanel);
}

const render = (props: Parameters<typeof Harness>[0]) =>
  renderWithProviders(createElement(Harness, props));

const quantityField = (name: string) =>
  screen.getByRole('textbox', {
    name: `Quantity: ${name}`,
  }) as HTMLInputElement;

const putQuantityCalls = () =>
  fetchMock.mock.calls
    .map(([arg]) => arg)
    .filter(
      (arg) =>
        arg.method === 'PUT' &&
        arg.path === '/api/procurement/order/quantities',
    );

describe('ProductsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUserContext).mockReturnValue({
      user: { id: 'me' } as never,
      setUser: vi.fn(),
      accessToken: 'token',
      setAccessToken: vi.fn(),
      isLoading: false,
    });
    vi.mocked(useFetchWithCreds).mockReturnValue(fetchMock as never);
    fetchMock.mockImplementation(async ({ method, path, body }) => {
      if (method === 'PUT' && path === '/api/procurement/order/quantities') {
        return { success: true, data: { id: `q-${body.productId}`, ...body } };
      }
      return { success: true, data: {} };
    });
  });

  it('shows the count, wraps long names and flags rows without a quantity', async () => {
    render({
      products: [product('p1', longName), product('p2', 'Galaxy S24')],
      quantities: [quantity('p1', 3), quantity('p2', 0)],
    });

    expect(screen.getByText('2 products')).toBeTruthy();
    expect(screen.getByText(longName)).toBeTruthy();
    await waitFor(() => expect(quantityField(longName).value).toBe('3'));
    expect(quantityField(longName).getAttribute('inputmode')).toBe('numeric');
    expect(screen.getAllByText('No quantity')).toHaveLength(1);
    expect(
      screen.getByText(
        'Products without a quantity are left out of the supplier files.',
      ),
    ).toBeTruthy();
  });

  it('saves quantities per product, so two quick edits both save', async () => {
    render({
      products: [product('p1', 'Alpha'), product('p2', 'Beta')],
      quantities: [quantity('p1', 1), quantity('p2', 2)],
    });
    await waitFor(() => expect(quantityField('Alpha').value).toBe('1'));

    fireEvent.change(quantityField('Alpha'), { target: { value: '12' } });
    fireEvent.change(quantityField('Beta'), { target: { value: '7 pcs' } });

    expect(quantityField('Alpha').value).toBe('12');
    expect(quantityField('Beta').value).toBe('7');
    expect(putQuantityCalls()).toHaveLength(0); // still debouncing

    await waitFor(() => expect(putQuantityCalls()).toHaveLength(2));
    expect(putQuantityCalls().map(({ body }) => body)).toEqual(
      expect.arrayContaining([
        { orderId, productId: 'p1', quantity: 12 },
        { orderId, productId: 'p2', quantity: 7 },
      ]),
    );
    expect(await screen.findAllByText('Saved')).toHaveLength(2);
    expect(latest.quantities.map((q) => q.quantity)).toEqual([12, 7]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('debounces keystrokes on one product into a single save', async () => {
    render({
      products: [product('p1', 'Alpha')],
      quantities: [quantity('p1', null)],
    });
    await userEvent.type(quantityField('Alpha'), '250');

    await waitFor(() => expect(putQuantityCalls()).toHaveLength(1));
    expect(putQuantityCalls()[0].body.quantity).toBe(250);
  });

  it('saves on blur without waiting for the debounce', async () => {
    render({
      products: [product('p1', 'Alpha')],
      quantities: [quantity('p1', 1)],
    });
    fireEvent.change(quantityField('Alpha'), { target: { value: '5' } });
    fireEvent.blur(quantityField('Alpha'));
    expect(putQuantityCalls()).toHaveLength(1);
  });

  it('reverts the quantity and notifies when saving fails', async () => {
    fetchMock.mockResolvedValue({ success: false, message: 'boom' });
    render({
      products: [product('p1', 'Alpha')],
      quantities: [quantity('p1', 4)],
    });
    await waitFor(() => expect(quantityField('Alpha').value).toBe('4'));

    fireEvent.change(quantityField('Alpha'), { target: { value: '40' } });
    expect(quantityField('Alpha').value).toBe('40');

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('failedToUpdateQuantity', 'error'),
    );
    expect(quantityField('Alpha').value).toBe('4');
  });

  it('removes a product from the order with the same API sequence, without mutating state', async () => {
    const prices: HistoryPrice = {
      [priceHash({ orderId, productId: 'p1', supplierId: 's1' })]: {
        value: 10.5,
      },
      [priceHash({ orderId, productId: 'p2', supplierId: 's1' })]: {
        value: 9,
      },
    };
    render({
      products: [product('p1', 'Alpha'), product('p2', 'Beta')],
      quantities: [quantity('p1', 1), quantity('p2', 2)],
      prices,
      suppliers: [supplier('s1'), supplier('s2')],
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove: Alpha' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() =>
      expect(latest.products.map((p) => p.id)).toEqual(['p2']),
    );
    expect(fetchMock.mock.calls.map(([arg]) => [arg.method, arg.path])).toEqual(
      [
        ['PUT', '/api/procurement/order'],
        ['DELETE', '/api/procurement/order/quantities'],
        ['DELETE', '/api/procurement/order/prices'],
      ],
    );
    expect(fetchMock.mock.calls[0][0].body.removedProductIds).toEqual(['p1']);
    // only the price cell that exists (s1), not s2
    expect(fetchMock.mock.calls[2][0].body.ids).toEqual([
      { orderId, productId: 'p1', supplierId: 's1' },
    ]);
    expect(latest.quantities.map((q) => q.productId)).toEqual(['p2']);
    expect(Object.keys(latest.prices)).toEqual([
      priceHash({ orderId, productId: 'p2', supplierId: 's1' }),
    ]);
    expect(latest.prices).not.toBe(prices);
    expect(Object.keys(prices)).toHaveLength(2); // original object untouched
    expect(latest.hashed.p1).toBeUndefined();
  });

  it('keeps the product when the order could not be updated', async () => {
    fetchMock.mockResolvedValue({ success: false, message: 'boom' });
    render({
      products: [product('p1', 'Alpha')],
      quantities: [quantity('p1', 1)],
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove: Alpha' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(latest.products).toHaveLength(1);
  });

  it('filters by name once the order has more than 8 products', async () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      product(`p${i}`, i === 4 ? 'Pixel 9' : `iPhone ${i}`),
    );
    render({ products: many, quantities: [] });

    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search in this order' }),
      'pixel',
    );
    await act(async () => {});
    expect(screen.getAllByTestId('procurement-product-row')).toHaveLength(1);
    expect(screen.getByText('Pixel 9')).toBeTruthy();
  });

  it('has no search for short orders', () => {
    render({ products: [product('p1', 'Alpha')], quantities: [] });
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('shows an empty state that opens the product catalog', async () => {
    render({ products: [], quantities: [] });

    expect(screen.getByText('No products in this order yet')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Add Products' }));
    expect(openCatalog).toHaveBeenCalledWith('product');
  });
});

describe('parseQuantityInput', () => {
  it('keeps digits only and returns null for an empty field', () => {
    expect(parseQuantityInput('')).toBeNull();
    expect(parseQuantityInput('12 шт')).toBe(12);
    expect(parseQuantityInput('0')).toBe(0);
    expect(parseQuantityInput('12345678')).toBe(123456);
  });
});
