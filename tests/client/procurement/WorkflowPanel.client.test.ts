// @vitest-environment jsdom

import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import WorkflowPanel from '@/pages/procurement/components/WorkflowPanel';
import { editProductPricesUtil } from '@/pages/procurement/lib/apiUtils';
import {
  buildEmptyOrderFiles,
  downloadFiles,
  toXlsxFile,
} from '@/pages/procurement/lib/orderFiles';
import { useProcurement } from '@/pages/procurement/lib/ProcurementContext';
import type { HistoryPrice } from '@/pages/procurement/lib/types';
import { ORDER_SHEET_NAME, priceHash } from '@/pages/procurement/lib/utils';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as ExcelJS from 'exceljs';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../helpers/renderWithProviders';

vi.mock('@/pages/lib/UserContext', () => ({ useUserContext: vi.fn() }));
vi.mock('@/pages/lib/fetch', () => ({ useFetchWithCreds: vi.fn() }));
vi.mock('@/pages/procurement/lib/apiUtils', () => ({
  editProductPricesUtil: vi.fn(),
}));
vi.mock('@/pages/procurement/lib/ProcurementContext', () => ({
  useProcurement: vi.fn(),
}));
vi.mock('@/pages/procurement/lib/orderFiles', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadFiles: vi.fn(),
}));

const ORDER = 'order-1';
const products = [
  { id: 'p1', name: 'Samsung S24' },
  { id: 'p2', name: 'AirPods Pro' },
];
const suppliers = [
  { id: 's1', name: 'Store A' },
  { id: 's2', name: 'Store B' },
];
const key = (productId: string, supplierId: string) =>
  priceHash({ orderId: ORDER, productId, supplierId });

const setPrices = vi.fn();
const setLoading = vi.fn();
const notify = vi.fn();

function useOrder(overrides: Record<string, unknown> = {}) {
  vi.mocked(useProcurement).mockReturnValue({
    selectedHistory: { id: ORDER },
    selectedProducts: products,
    selectedSuppliers: suppliers,
    hashedQuantities: { p1: 2, p2: 1 },
    prices: {},
    setPrices,
    setLoading,
    notify,
    setSnackbarMessage: vi.fn(),
    setSnackbarOpen: vi.fn(),
    ...overrides,
  } as never);
}

const render = () => renderWithProviders(createElement(WorkflowPanel));
const step = (name: string) => screen.getByTestId(`procurement-step-${name}`);

function setMobile(mobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: mobile,
      media: query,
      onchange: null as never,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

/** An empty order file for Store A with prices typed into column C. */
async function filledFileForStoreA(pricesByRow: Record<number, unknown>) {
  const { files } = buildEmptyOrderFiles({
    products,
    suppliers,
    quantities: { p1: 2, p2: 1 },
  });
  const empty = (await toXlsxFile(files[0]))!;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await empty.arrayBuffer());
  const sheet = workbook.getWorksheet(ORDER_SHEET_NAME)!;
  Object.entries(pricesByRow).forEach(([row, value]) => {
    sheet.getRow(Number(row)).getCell(3).value = value as ExcelJS.CellValue;
  });
  return new File([await workbook.xlsx.writeBuffer()], empty.name);
}

describe('WorkflowPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMobile(false);
    vi.mocked(useUserContext).mockReturnValue({ accessToken: 't' } as never);
    vi.mocked(useFetchWithCreds).mockReturnValue(vi.fn() as never);
    vi.mocked(editProductPricesUtil).mockResolvedValue(true);
    useOrder();
  });

  afterEach(() => {
    const nav = navigator as unknown as Record<string, unknown>;
    delete nav.share;
    delete nav.canShare;
  });

  it('renders nothing without an open order', () => {
    useOrder({ selectedHistory: undefined });
    render();
    expect(screen.queryByTestId('procurement-workflow')).toBeNull();
  });

  it('shows the four steps with their status on desktop', () => {
    render();
    expect(
      within(step('empty')).getByText('Empty files for stores'),
    ).toBeTruthy();
    expect(
      within(step('empty')).getByText('2 stores · 2 products'),
    ).toBeTruthy();
    expect(
      within(step('upload')).getByText(
        'The files stores sent back with prices',
      ),
    ).toBeTruthy();
    expect(
      within(step('calculate')).getByText('Upload prices first'),
    ).toBeTruthy();
    expect(within(step('final')).getByText('Calculate first')).toBeTruthy();
    expect(
      within(step('calculate')).getByRole('button', { name: 'Calculate' }),
    ).toBeDisabled();
    expect(
      within(step('final')).getByRole('button', { name: 'Download' }),
    ).toBeDisabled();
    expect(screen.getByText('0 of 4 done')).toBeTruthy();
  });

  it('explains why the first step is blocked', () => {
    useOrder({ selectedSuppliers: [] });
    const { unmount } = render();
    expect(within(step('empty')).getByText('Add suppliers first')).toBeTruthy();
    expect(
      within(step('empty')).getByRole('button', { name: 'Download' }),
    ).toBeDisabled();
    unmount();

    useOrder({ hashedQuantities: { p1: 0, p2: null } });
    render();
    expect(
      within(step('empty')).getByText('All product quantities are zero!'),
    ).toBeTruthy();
  });

  it('marks steps done from the order data', () => {
    const prices: HistoryPrice = {
      [key('p1', 's1')]: { value: 10, color: 'green' },
      [key('p1', 's2')]: { value: 12, color: 'orange' },
      [key('p2', 's1')]: { value: 5.5, color: 'green' },
    };
    useOrder({ prices });
    render();
    expect(step('empty').dataset.done).toBe('true');
    expect(step('upload').dataset.done).toBe('true');
    expect(
      within(step('upload')).getByText('3 of 4 prices filled'),
    ).toBeTruthy();
    expect(step('calculate').dataset.done).toBe('true');
    expect(
      within(step('calculate')).getByText('Cheapest found for 2 of 2 products'),
    ).toBeTruthy();
    expect(within(step('final')).getByText('1 file · 2 products')).toBeTruthy();
    expect(step('final').dataset.done).toBe('false');
    expect(screen.getByText('3 of 4 done')).toBeTruthy();
  });

  it('warns when prices changed after the last calculation', () => {
    useOrder({
      prices: {
        [key('p1', 's1')]: { value: 10, color: 'green' },
        [key('p1', 's2')]: { value: 8 },
      },
    });
    render();
    expect(step('calculate').dataset.done).toBe('false');
    expect(
      within(step('calculate')).getByText('Prices changed — calculate again'),
    ).toBeTruthy();
  });

  it('downloads one empty file per store on desktop', async () => {
    render();
    await userEvent.click(
      within(step('empty')).getByRole('button', { name: 'Download' }),
    );
    await waitFor(() => expect(downloadFiles).toHaveBeenCalledTimes(1));
    const files = vi.mocked(downloadFiles).mock.calls[0][0];
    expect(files.map((f) => f.name)).toEqual([
      expect.stringMatching(/^Rahmanov-Store A-\d\d-\d\d-\d{4}-TBF\.xlsx$/),
      expect.stringMatching(/^Rahmanov-Store B-\d\d-\d\d-\d{4}-TBF\.xlsx$/),
    ]);
    await waitFor(() => expect(step('empty').dataset.done).toBe('true'));
    expect(setLoading).toHaveBeenLastCalledWith(false);
  });

  it('imports an uploaded file, saves the prices and shows the result', async () => {
    render();
    const input = screen.getByTestId(
      'procurement-upload-input',
    ) as HTMLInputElement;
    expect(input.accept).toContain('.xlsx');
    expect(input.multiple).toBe(true);
    // Rows are sorted by name: AirPods Pro (p2), Samsung S24 (p1).
    const file = await filledFileForStoreA({ 2: '99,5', 3: 1200 });
    fireEvent.change(input, { target: { files: [file] } });

    const sheet = await screen.findByTestId('procurement-upload-result');
    expect(editProductPricesUtil).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedPrices: expect.arrayContaining([
          {
            orderId: ORDER,
            productId: 'p2',
            supplierId: 's1',
            price: 99.5,
            color: null,
          },
          {
            orderId: ORDER,
            productId: 'p1',
            supplierId: 's1',
            price: 1200,
            color: null,
          },
        ]),
      }),
    );
    const merge = setPrices.mock.calls[0][0] as (
      p: HistoryPrice,
    ) => HistoryPrice;
    expect(merge({})).toEqual({
      [key('p2', 's1')]: { value: 99.5 },
      [key('p1', 's1')]: { value: 1200 },
    });
    expect(
      within(sheet).getByText('1 of 1 files read · 2 prices imported'),
    ).toBeTruthy();
    expect(within(sheet).getByText('Store A')).toBeTruthy();
    expect(input.value).toBe('');
  });

  it('lists files it could not read', async () => {
    render();
    fireEvent.change(screen.getByTestId('procurement-upload-input'), {
      target: { files: [new File(['nope'], 'scan.xlsx')] },
    });
    const sheet = await screen.findByTestId('procurement-upload-result');
    expect(within(sheet).getByText('scan.xlsx')).toBeTruthy();
    expect(
      within(sheet).getByText(
        "Couldn't read this file. Is it one of our order files?",
      ),
    ).toBeTruthy();
    expect(editProductPricesUtil).not.toHaveBeenCalled();
    expect(
      within(sheet).queryByRole('button', { name: 'Calculate' }),
    ).toBeNull();
  });

  it('calculates and stores the colours', async () => {
    useOrder({
      prices: {
        [key('p1', 's1')]: { value: 10 },
        [key('p1', 's2')]: { value: 12 },
        [key('p2', 's1')]: { value: 7 },
        [key('p2', 's2')]: { value: 6 },
      },
    });
    render();
    await userEvent.click(
      within(step('calculate')).getByRole('button', { name: 'Calculate' }),
    );
    await waitFor(() => expect(setPrices).toHaveBeenCalled());
    const { updatedPrices } = vi.mocked(editProductPricesUtil).mock.calls[0][0];
    expect(updatedPrices).toEqual([
      { orderId: ORDER, productId: 'p1', supplierId: 's1', color: 'green' },
      { orderId: ORDER, productId: 'p1', supplierId: 's2', color: 'orange' },
      { orderId: ORDER, productId: 'p2', supplierId: 's1', color: 'orange' },
      { orderId: ORDER, productId: 'p2', supplierId: 's2', color: 'green' },
    ]);
    expect(setPrices.mock.calls[0][0][key('p2', 's2')]).toEqual({
      value: 6,
      color: 'green',
    });
  });

  it('does not touch local colours when saving them fails', async () => {
    vi.mocked(editProductPricesUtil).mockResolvedValue(false);
    useOrder({ prices: { [key('p1', 's1')]: { value: 10 } } });
    render();
    await userEvent.click(
      within(step('calculate')).getByRole('button', { name: 'Calculate' }),
    );
    await waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
    expect(setPrices).not.toHaveBeenCalled();
  });

  it('downloads only the winning lines as final files', async () => {
    useOrder({
      prices: {
        [key('p1', 's1')]: { value: 10, color: 'green' },
        [key('p2', 's1')]: { value: 7, color: 'orange' },
        [key('p2', 's2')]: { value: 6, color: 'green' },
      },
    });
    render();
    await userEvent.click(
      within(step('final')).getByRole('button', { name: 'Download' }),
    );
    await waitFor(() => expect(downloadFiles).toHaveBeenCalled());
    const files = vi.mocked(downloadFiles).mock.calls[0][0];
    expect(files.map((f) => f.name)).toEqual([
      expect.stringMatching(/^Rahmanov-Store A-\d\d-\d\d-\d{4}\.xlsx$/),
      expect.stringMatching(/^Rahmanov-Store B-\d\d-\d\d-\d{4}\.xlsx$/),
    ]);
    await waitFor(() => expect(step('final').dataset.done).toBe('true'));
  });

  describe('on phones', () => {
    beforeEach(() => setMobile(true));

    it('folds to the next step and expands to all four', async () => {
      useOrder({ prices: { [key('p1', 's1')]: { value: 10 } } });
      render();
      const toggle = await screen.findByRole('button', {
        name: 'Show all steps',
      });
      expect(screen.queryByTestId('procurement-step-empty')).toBeNull();
      expect(step('calculate')).toBeTruthy();
      expect(
        within(step('calculate')).getByText(
          'Find the cheapest store for each product',
        ),
      ).toBeTruthy();
      expect(toggle.getAttribute('aria-expanded')).toBe('false');

      await userEvent.click(toggle);
      expect(screen.getAllByTestId(/^procurement-step-/)).toHaveLength(4);
      expect(
        screen
          .getByRole('button', { name: 'Hide steps' })
          .getAttribute('aria-expanded'),
      ).toBe('true');
    });

    it('offers Share and sends each store its own file', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { share, canShare: () => true });
      render();
      const button = await within(step('empty')).findByRole('button', {
        name: 'Share',
      });
      await userEvent.click(button);

      const sheet = await screen.findByTestId('procurement-files-sheet');
      expect(downloadFiles).not.toHaveBeenCalled();
      expect(within(sheet).getByText('Store A')).toBeTruthy();
      expect(within(sheet).getByText('Store B')).toBeTruthy();

      await userEvent.click(
        within(sheet).getByRole('button', { name: 'Share: Store B' }),
      );
      expect(share).toHaveBeenCalledTimes(1);
      const [{ files, title }] = share.mock.calls[0];
      expect(title).toBe('Store B');
      expect(files).toHaveLength(1);
      expect(files[0].name).toMatch(/^Rahmanov-Store B-.*-TBF\.xlsx$/);

      await userEvent.click(
        within(sheet).getByRole('button', { name: 'Download all' }),
      );
      expect(downloadFiles).toHaveBeenCalledWith([
        expect.any(File),
        expect.any(File),
      ]);
    });

    it('tells the user when sharing fails', async () => {
      Object.assign(navigator, {
        share: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
        canShare: () => true,
      });
      render();
      await userEvent.click(
        await within(step('empty')).findByRole('button', { name: 'Share' }),
      );
      const sheet = await screen.findByTestId('procurement-files-sheet');
      await userEvent.click(
        within(sheet).getByRole('button', { name: 'Share all' }),
      );
      await waitFor(() =>
        expect(notify).toHaveBeenCalledWith('procurementShareFailed', 'error'),
      );
    });

    it('falls back to download where files cannot be shared', async () => {
      render();
      await userEvent.click(
        await within(step('empty')).findByRole('button', { name: 'Download' }),
      );
      await waitFor(() => expect(downloadFiles).toHaveBeenCalled());
      expect(screen.queryByTestId('procurement-files-sheet')).toBeNull();
    });
  });
});
