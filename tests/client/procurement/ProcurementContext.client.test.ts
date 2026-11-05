// @vitest-environment jsdom

import { useDollarRateContext } from '@/pages/lib/DollarRateContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import * as api from '@/pages/procurement/lib/apiUtils';
import {
  ProcurementProvider,
  useProcurement,
} from '@/pages/procurement/lib/ProcurementContext';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/lib/UserContext', () => ({ useUserContext: vi.fn() }));
vi.mock('@/pages/lib/DollarRateContext', () => ({
  useDollarRateContext: vi.fn(),
}));
vi.mock('@/pages/lib/fetch', () => ({ useFetchWithCreds: vi.fn() }));
vi.mock('@/pages/procurement/lib/apiUtils', () => ({
  getHistoryListUtil: vi.fn(),
  getHistoryUtil: vi.fn(),
  createHistoryUtil: vi.fn(),
  editHistoryUtil: vi.fn(),
  createProductQuantityUtil: vi.fn(),
  editDollarRateUtil: vi.fn(),
  createProductUtil: vi.fn(),
  createSupplierUtil: vi.fn(),
  deleteProductUtil: vi.fn(),
  deleteSupplierUtil: vi.fn(),
  editProductUtil: vi.fn(),
  editSupplierUtil: vi.fn(),
  handleProductSearchUtil: vi.fn(),
  handleSupplierSearchUtil: vi.fn(),
}));

const mocked = vi.mocked(api);
const setRates = vi.fn();
const rates = [
  { id: 1, currency: 'AED', name: 'Dirham', rate: 3.67, isDefault: false },
  { id: 2, currency: 'TMT', name: 'Manat', rate: 19.5, isDefault: true },
];

const order = (id: string, extra: object = {}): any => ({
  id,
  name: `Order ${id}`,
  currency: 'AED',
  dollarRateId: null as number | null,
  createdAt: new Date(),
  updatedAt: new Date(),
  suppliers: [] as unknown[],
  products: [] as unknown[],
  prices: [
    {
      id: 'p1',
      orderId: id,
      productId: 'prod1',
      supplierId: 'sup1',
      price: 12.5,
      color: 'green',
    },
  ],
  productQuantities: [] as unknown[],
  ...extra,
});

/** Mimics getHistoryUtil: pushes the loaded order into the provider's setters. */
function mockLoadOrder() {
  mocked.getHistoryUtil.mockImplementation(async (args: any) => {
    const o = order(args.id);
    args.setSelectedHistory(o);
    args.setSelectedProducts([{ id: 'prod1', name: 'iPhone' }]);
    args.setSelectedSuppliers([{ id: 'sup1', name: 'Store A' }]);
    args.setProductQuantities([
      { id: 'q1', orderId: args.id, productId: 'prod1', quantity: 3 },
    ]);
    return o as any;
  });
}

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(ProcurementProvider, null, children);

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/procurement');
  vi.mocked(useUserContext).mockReturnValue({
    user: { grade: 'SUPERUSER' },
    accessToken: 'token',
  } as any);
  vi.mocked(useDollarRateContext).mockReturnValue({ rates, setRates } as any);
  vi.mocked(useFetchWithCreds).mockReturnValue(vi.fn() as any);
  mocked.getHistoryListUtil.mockResolvedValue({ id: 'latest' } as any);
  mockLoadOrder();
});

describe('ProcurementProvider', () => {
  it('opens the latest order and derives prices, quantities and rate', async () => {
    const { result } = renderHook(() => useProcurement(), { wrapper });

    await waitFor(() => expect(result.current.initialLoading).toBe(false));
    expect(mocked.getHistoryUtil).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'latest' }),
    );
    expect(result.current.selectedHistory?.id).toBe('latest');
    expect(result.current.hashedQuantities).toEqual({ prod1: 3 });
    expect(Object.values(result.current.prices)).toEqual([
      { value: 12.5, color: 'green' },
    ]);
    expect(result.current.orderCurrencyRate?.name).toBe('Dirham');
  });

  it('opens the order named in ?order= instead of the latest', async () => {
    window.history.replaceState(null, '', '/procurement?order=abc');
    const { result } = renderHook(() => useProcurement(), { wrapper });

    await waitFor(() => expect(result.current.selectedHistory?.id).toBe('abc'));
    expect(mocked.getHistoryUtil).toHaveBeenCalledTimes(1);
  });

  it('createOrder clears the previous order lines', async () => {
    mocked.createHistoryUtil.mockImplementation(async (args: any) => {
      args.setSelectedHistory(order('new', { prices: [] }));
      return order('new') as any;
    });
    const { result } = renderHook(() => useProcurement(), { wrapper });
    await waitFor(() =>
      expect(result.current.selectedProducts).toHaveLength(1),
    );

    await act(() => result.current.createOrder('Week 45'));

    expect(result.current.selectedProducts).toEqual([]);
    expect(result.current.selectedSuppliers).toEqual([]);
    expect(result.current.hashedQuantities).toEqual({});
    expect(result.current.prices).toEqual({});
  });

  it('adds a catalog product to the order with its quantity row', async () => {
    mocked.editHistoryUtil.mockResolvedValue({ id: 'latest' } as any);
    mocked.createProductQuantityUtil.mockResolvedValue({
      id: 'q2',
      orderId: 'latest',
      productId: 'prod2',
      quantity: null,
    } as any);
    const { result } = renderHook(() => useProcurement(), { wrapper });
    await waitFor(() => expect(result.current.initialLoading).toBe(false));

    act(() => result.current.openCatalog('product'));
    await act(() =>
      result.current.addCatalogItemToOrder({
        id: 'prod2',
        name: 'Pixel',
      } as any),
    );

    expect(mocked.editHistoryUtil).toHaveBeenCalledWith(
      expect.objectContaining({ addedProductIds: ['prod2'] }),
    );
    expect(result.current.selectedProducts.map((p) => p.id)).toEqual([
      'prod2',
      'prod1',
    ]);
    expect(result.current.productQuantities[0].productId).toBe('prod2');
  });

  it('reverts an optimistic rate change when saving fails', async () => {
    mocked.editDollarRateUtil.mockResolvedValue(undefined);
    const { result } = renderHook(() => useProcurement(), { wrapper });
    await waitFor(() =>
      expect(result.current.orderCurrencyRate?.rate).toBe(3.67),
    );

    await act(() => result.current.changeRate(3.7));

    expect(mocked.editDollarRateUtil).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'AED', rate: 3.7 }),
    );
    expect(result.current.orderCurrencyRate?.rate).toBe(3.67);
  });

  it('switching currency keeps prices entered since the order loaded', async () => {
    mocked.editHistoryUtil.mockResolvedValue({ id: 'latest' } as any);
    const { result } = renderHook(() => useProcurement(), { wrapper });
    await waitFor(() => expect(result.current.initialLoading).toBe(false));

    // A price typed or uploaded after load lives only in `prices`, not in
    // the selectedHistory snapshot.
    act(() =>
      result.current.setPrices((curr) => ({
        ...curr,
        typed: { value: 7.25, color: 'white' },
      })),
    );
    await act(() => result.current.changeCurrency('TMT' as any));

    expect(result.current.selectedHistory?.currency).toBe('TMT');
    expect(result.current.orderCurrencyRate?.name).toBe('Manat');
    expect(result.current.prices.typed).toEqual({
      value: 7.25,
      color: 'white',
    });
    expect(Object.values(result.current.prices)).toHaveLength(2);
  });

  it('notify opens the toast with an i18n key', async () => {
    const { result } = renderHook(() => useProcurement(), { wrapper });
    act(() => result.current.notify('emptyField', 'error'));
    expect(result.current.snackbarOpen).toBe(true);
    expect(result.current.snackbarMessage).toEqual({
      message: 'emptyField',
      severity: 'error',
    });
  });
});
