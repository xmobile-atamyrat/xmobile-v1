import { OrderPriceColor } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import {
  buildEmptyOrderFiles,
  buildFinalOrderFiles,
  countCheapestFound,
  countFilledPrices,
  emptyOrderFilename,
  finalOrderFilename,
  hasUncalculatedPrices,
  orderedProducts,
  parsePriceCell,
  readFilledOrderFile,
  readFilledOrderFiles,
  sortByName,
  toXlsxFile,
  xlsxFilename,
} from '@/pages/procurement/lib/orderFiles';
import type { HistoryPrice } from '@/pages/procurement/lib/types';
import {
  ExcelFileData,
  IDS_SHEET_NAME,
  ORDER_SHEET_NAME,
  priceHash,
} from '@/pages/procurement/lib/utils';

const ORDER = 'order-1';
const DATE = new Date(2026, 10, 2); // 02-11-2026

const products = [
  { id: 'p-sam', name: 'Samsung S24' },
  { id: 'p-iph', name: 'iPhone 15 Pro Max 256GB Natural Titanium' },
  { id: 'p-air', name: 'AirPods Pro' },
  { id: 'p-zero', name: 'Apple Watch' },
];
const suppliers = [
  { id: 's-a', name: 'Store A' },
  { id: 's-b', name: 'Store B' },
];
const quantities = { 'p-sam': 2, 'p-iph': 5, 'p-air': 1, 'p-zero': 0 };

const key = (productId: string, supplierId: string) =>
  priceHash({ orderId: ORDER, productId, supplierId });

describe('sortByName / orderedProducts', () => {
  it('sorts by plain code units (uppercase before lowercase) without mutating', () => {
    const input = [...products];
    expect(sortByName(input).map(({ name }) => name)).toEqual([
      'AirPods Pro',
      'Apple Watch',
      'Samsung S24',
      'iPhone 15 Pro Max 256GB Natural Titanium',
    ]);
    expect(input).toEqual(products);
  });

  it('keeps only products with a quantity above zero', () => {
    expect(
      orderedProducts(products, {
        ...quantities,
        'p-air': null,
      }).map(({ id }) => id),
    ).toEqual(['p-sam', 'p-iph']);
  });
});

describe('filenames', () => {
  it('uses the Rahmanov prefix, dd-mm-yyyy and -TBF for empty files', () => {
    expect(emptyOrderFilename('Store A', DATE)).toBe(
      'Rahmanov-Store A-02-11-2026-TBF',
    );
    expect(finalOrderFilename('Store A', DATE)).toBe(
      'Rahmanov-Store A-02-11-2026',
    );
  });

  it('adds .xlsx once', () => {
    expect(xlsxFilename('a')).toBe('a.xlsx');
    expect(xlsxFilename('a.XLSX')).toBe('a.XLSX');
  });
});

describe('buildEmptyOrderFiles', () => {
  it('builds one file per supplier with sorted lines and an empty price column', () => {
    const { files, error } = buildEmptyOrderFiles({
      products,
      suppliers,
      quantities,
      date: DATE,
    });
    expect(error).toBeUndefined();
    expect(files).toHaveLength(2);
    expect(files[0]).toEqual({
      filename: 'Rahmanov-Store A-02-11-2026-TBF',
      supplierId: 's-a',
      productIds: ['p-air', 'p-sam', 'p-iph'],
      data: [
        ['', 'Quantity', 'Price'],
        ['AirPods Pro', 1, ''],
        ['Samsung S24', 2, ''],
        ['iPhone 15 Pro Max 256GB Natural Titanium', 5, ''],
      ],
    });
    expect(files[1].filename).toBe('Rahmanov-Store B-02-11-2026-TBF');
    expect(files[1].supplierId).toBe('s-b');
    expect(files[1].data).toEqual(files[0].data);
    // Separate arrays per file, so editing one can't leak into another.
    expect(files[1].productIds).not.toBe(files[0].productIds);
  });

  it('reports allQuantitiesZero when nothing has a quantity (or no products)', () => {
    expect(
      buildEmptyOrderFiles({
        products,
        suppliers,
        quantities: { 'p-sam': 0, 'p-iph': null },
      }),
    ).toEqual({ files: [], error: 'allQuantitiesZero' });
    expect(
      buildEmptyOrderFiles({ products: [], suppliers, quantities }).error,
    ).toBe('allQuantitiesZero');
  });

  it('reports noProductsOrSuppliers without suppliers', () => {
    expect(
      buildEmptyOrderFiles({ products, suppliers: [], quantities }).error,
    ).toBe('noProductsOrSuppliers');
  });
});

describe('buildFinalOrderFiles', () => {
  const prices: HistoryPrice = {
    [key('p-sam', 's-a')]: { value: 900.5, color: OrderPriceColor.green },
    [key('p-sam', 's-b')]: { value: 950, color: OrderPriceColor.orange },
    [key('p-iph', 's-a')]: { value: 1300, color: OrderPriceColor.orange },
    [key('p-iph', 's-b')]: { value: 1200, color: OrderPriceColor.green },
    [key('p-air', 's-a')]: { value: 200, color: OrderPriceColor.white },
    [key('p-air', 's-b')]: { value: 190, color: OrderPriceColor.green },
    // green but quantity 0 -> not ordered
    [key('p-zero', 's-a')]: { value: 300, color: OrderPriceColor.green },
  };

  it('puts only green, priced lines with a quantity into each supplier file, sorted', () => {
    const files = buildFinalOrderFiles({
      orderId: ORDER,
      products,
      suppliers,
      quantities,
      prices,
      date: DATE,
    });
    expect(files).toEqual<ExcelFileData[]>([
      {
        filename: 'Rahmanov-Store A-02-11-2026',
        supplierId: 's-a',
        productIds: ['p-sam'],
        data: [
          ['', 'Quantity', 'Price'],
          ['Samsung S24', 2, 900.5],
        ],
      },
      {
        filename: 'Rahmanov-Store B-02-11-2026',
        supplierId: 's-b',
        productIds: ['p-air', 'p-iph'],
        data: [
          ['', 'Quantity', 'Price'],
          ['AirPods Pro', 1, 190],
          ['iPhone 15 Pro Max 256GB Natural Titanium', 5, 1200],
        ],
      },
    ]);
  });

  it('skips green cells without a positive price and suppliers that won nothing', () => {
    const files = buildFinalOrderFiles({
      orderId: ORDER,
      products,
      suppliers: [...suppliers, { id: 's-c', name: 'Store C' }],
      quantities,
      prices: {
        [key('p-sam', 's-a')]: { value: 0, color: OrderPriceColor.green },
        [key('p-iph', 's-a')]: {
          value: undefined as unknown as number,
          color: OrderPriceColor.green,
        },
        [key('p-air', 's-c')]: { value: 5, color: OrderPriceColor.green },
      },
      date: DATE,
    });
    expect(files.map(({ supplierId }) => supplierId)).toEqual(['s-c']);
  });

  it('ignores prices from another order', () => {
    expect(
      buildFinalOrderFiles({
        orderId: 'other-order',
        products,
        suppliers,
        quantities,
        prices,
      }),
    ).toEqual([]);
  });
});

describe('progress counters', () => {
  const grid = (prices: HistoryPrice) => ({
    orderId: ORDER,
    productIds: ['p-sam', 'p-iph'],
    supplierIds: ['s-a', 's-b'],
    prices,
  });

  it('counts filled cells and products with a cheapest (green) price', () => {
    const prices: HistoryPrice = {
      [key('p-sam', 's-a')]: { value: 1, color: OrderPriceColor.green },
      [key('p-sam', 's-b')]: { value: 2, color: OrderPriceColor.orange },
      [key('p-iph', 's-a')]: { value: 3, color: OrderPriceColor.white },
      [key('p-iph', 's-b')]: { value: undefined as unknown as number },
      [key('p-air', 's-a')]: { value: 4, color: OrderPriceColor.green },
    };
    expect(countFilledPrices(grid(prices))).toBe(3);
    expect(countCheapestFound(grid(prices))).toBe(1);
    expect(hasUncalculatedPrices(grid(prices))).toBe(false);
  });

  it('flags priced cells without a colour as uncalculated', () => {
    expect(
      hasUncalculatedPrices(
        grid({
          [key('p-sam', 's-a')]: { value: 1, color: OrderPriceColor.green },
          [key('p-iph', 's-b')]: { value: 2 },
        }),
      ),
    ).toBe(true);
  });
});

describe('parsePriceCell', () => {
  it.each<[ExcelJS.CellValue, number | undefined]>([
    [1250, 1250],
    [3.67, 3.67],
    ['3,67', 3.67],
    ['1 250.5', 1250.5],
    ['1 250,5', 1250.5],
    ['1,250.50', 1250.5],
    ['1,250,000', 1250000],
    ['950 TMT', 950],
    ['$1200', 1200],
    ['', undefined],
    ['n/a', undefined],
    ['нет', undefined],
    [null, undefined],
    [{ formula: 'A1*2', result: 42.5 } as ExcelJS.CellValue, 42.5],
    [{ richText: [{ text: '1 0' }, { text: '00,5' }] }, 1000.5],
    [Number.NaN, undefined],
  ])('%j -> %s', (input, expected) => {
    expect(parsePriceCell(input)).toBe(expected);
  });
});

/** Opens a built file, writes prices into column C, returns it as a File. */
async function fillPrices(
  file: File,
  pricesByRow: Record<number, ExcelJS.CellValue>,
): Promise<File> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet(ORDER_SHEET_NAME)!;
  Object.entries(pricesByRow).forEach(([row, value]) => {
    sheet.getRow(Number(row)).getCell(3).value = value;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer], file.name);
}

describe('workbook round trip', () => {
  const scope = {
    supplierIds: ['s-a', 's-b'],
    productIds: products.map(({ id }) => id),
  };

  async function emptyFiles() {
    const { files } = buildEmptyOrderFiles({
      products,
      suppliers,
      quantities,
      date: DATE,
    });
    return Promise.all(files.map(async (f) => (await toXlsxFile(f))!));
  }

  it('writes the Order sheet and a very hidden IDs sheet', async () => {
    const [fileA] = await emptyFiles();
    expect(fileA.name).toBe('Rahmanov-Store A-02-11-2026-TBF.xlsx');
    expect(fileA.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await fileA.arrayBuffer());
    // (utils sets `workbook.model.keywords`, which ExcelJS never saves; the
    // supplier id travels in the IDs sheet only.)
    const order = workbook.getWorksheet(ORDER_SHEET_NAME)!;
    expect(order.getRow(1).values).toEqual([
      undefined,
      '',
      'Quantity',
      'Price',
    ]);
    expect(order.getRow(2).values).toEqual([undefined, 'AirPods Pro', 1, '']);
    const ids = workbook.getWorksheet(IDS_SHEET_NAME)!;
    expect(ids.state).toBe('veryHidden');
    expect(ids.getRow(2).values).toEqual([undefined, 's-a', 'p-air']);
    expect(ids.getRow(3).values).toEqual([undefined, '', 'p-sam']);
  });

  it('reads filled prices back with decimals and comma decimals', async () => {
    const [fileA] = await emptyFiles();
    const filled = await fillPrices(fileA, { 2: 190.25, 3: '900,5', 4: 1200 });
    const { result, prices } = await readFilledOrderFile(ORDER, filled, scope);
    expect(result).toEqual({
      fileName: 'Rahmanov-Store A-02-11-2026-TBF.xlsx',
      supplierId: 's-a',
      imported: 3,
    });
    expect(prices).toEqual({
      [key('p-air', 's-a')]: { value: 190.25 },
      [key('p-sam', 's-a')]: { value: 900.5 },
      [key('p-iph', 's-a')]: { value: 1200 },
    });
  });

  it('skips empty, zero, negative prices and products no longer in the order', async () => {
    const [fileA] = await emptyFiles();
    const filled = await fillPrices(fileA, { 2: 0, 3: -5, 4: 1200 });
    const { result, prices } = await readFilledOrderFile(ORDER, filled, {
      supplierIds: ['s-a'],
      productIds: ['p-air', 'p-sam'], // p-iph was removed from the order
    });
    expect(prices).toEqual({});
    expect(result.error).toBe('noPrices');
  });

  it('rejects files for a supplier outside the order and unreadable files', async () => {
    const [, fileB] = await emptyFiles();
    const filledB = await fillPrices(fileB, { 2: 1 });
    const outside = await readFilledOrderFile(ORDER, filledB, {
      supplierIds: ['s-a'],
      productIds: scope.productIds,
    });
    expect(outside.result).toMatchObject({
      error: 'notThisOrder',
      supplierId: 's-b',
      imported: 0,
    });

    const junk = new File([new Uint8Array([1, 2, 3])], 'photo.xlsx');
    expect((await readFilledOrderFile(ORDER, junk, scope)).result).toEqual({
      fileName: 'photo.xlsx',
      supplierId: undefined,
      imported: 0,
      error: 'unreadable',
    });

    // A real workbook that isn't one of ours (no IDs sheet).
    const foreign = new ExcelJS.Workbook();
    foreign.addWorksheet('Sheet1').addRow(['x', 1, 2]);
    const foreignFile = new File(
      [await foreign.xlsx.writeBuffer()],
      'other.xlsx',
    );
    expect(
      (await readFilledOrderFile(ORDER, foreignFile, scope)).result.error,
    ).toBe('unreadable');
  });

  it('reads several files, one bad file does not stop the others', async () => {
    const [fileA, fileB] = await emptyFiles();
    const result = await readFilledOrderFiles(
      ORDER,
      [
        await fillPrices(fileA, { 2: 10 }),
        new File(['not a workbook'], 'broken.xlsx'),
        await fillPrices(fileB, { 3: 20, 4: 30 }),
      ],
      scope,
    );
    expect(
      result.files.map(({ imported, error }) => [imported, error]),
    ).toEqual([
      [1, undefined],
      [0, 'unreadable'],
      [2, undefined],
    ]);
    expect(result.prices).toEqual({
      [key('p-air', 's-a')]: { value: 10 },
      [key('p-sam', 's-b')]: { value: 20 },
      [key('p-iph', 's-b')]: { value: 30 },
    });
  });
});
