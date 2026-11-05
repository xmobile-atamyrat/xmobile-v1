import { HistoryPrice } from '@/pages/procurement/lib/types';
import {
  dayMonthYearFromDate,
  ExcelFileData,
  IDS_SHEET_NAME,
  ORDER_SHEET_NAME,
  priceHash,
  XLSX_MIME_TYPE,
  xlsxBlobFromFileData,
} from '@/pages/procurement/lib/utils';
import { OrderPriceColor } from '@prisma/client';
import * as ExcelJS from 'exceljs';

// The procurement file round trip, without React:
//   buildEmptyOrderFiles -> one "…-TBF" workbook per supplier (to be filled)
//   readFilledOrderFiles -> prices back out of those workbooks
//   buildFinalOrderFiles -> one workbook per supplier with its cheapest lines
// The workbook layout (Order sheet + very hidden IDs sheet) is unchanged from
// the old Actions menu, so files sent to stores before this release still
// upload fine.

/** Business convention: every file is named after the buyer. */
export const ORDER_FILE_PREFIX = 'Rahmanov';
export const ORDER_FILE_HEADER: (string | number)[] = ['', 'Quantity', 'Price'];

type Named = { id: string; name: string };
/** productId -> quantity; null/undefined while a field is empty. */
export type Quantities = Record<string, number | null | undefined>;

/** Plain code-unit order by name, as the files have always been sorted. */
export function sortByName<T extends Named>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  });
}

const hasQuantity = (quantities: Quantities, productId: string) =>
  (quantities[productId] ?? 0) > 0;

export const emptyOrderFilename = (supplierName: string, date: Date) =>
  `${ORDER_FILE_PREFIX}-${supplierName}-${dayMonthYearFromDate(date)}-TBF`;

export const finalOrderFilename = (supplierName: string, date: Date) =>
  `${ORDER_FILE_PREFIX}-${supplierName}-${dayMonthYearFromDate(date)}`;

/** Products that go into the files: quantity > 0, sorted by name. */
export function orderedProducts<T extends Named>(
  products: T[],
  quantities: Quantities,
): T[] {
  return sortByName(products).filter(({ id }) => hasQuantity(quantities, id));
}

export type EmptyOrderFilesError =
  | 'allQuantitiesZero'
  | 'noProductsOrSuppliers';

/**
 * One empty workbook per supplier: every product with a quantity, an empty
 * Price column for the store to fill in. `error` is an i18n key when there is
 * nothing to send.
 */
export function buildEmptyOrderFiles({
  products,
  suppliers,
  quantities,
  date = new Date(),
}: {
  products: Named[];
  suppliers: Named[];
  quantities: Quantities;
  date?: Date;
}): { files: ExcelFileData[]; error?: EmptyOrderFilesError } {
  const lines = orderedProducts(products, quantities);
  if (lines.length === 0) return { files: [], error: 'allQuantitiesZero' };
  const productIds = lines.map(({ id }) => id);
  const rows = lines.map(({ id, name }) => [name, quantities[id], '']);
  const files = suppliers.map(
    (supplier): ExcelFileData => ({
      filename: emptyOrderFilename(supplier.name, date),
      data: [[...ORDER_FILE_HEADER], ...rows.map((row) => [...row])],
      supplierId: supplier.id,
      productIds: [...productIds],
    }),
  );
  if (files.length === 0) return { files, error: 'noProductsOrSuppliers' };
  return { files };
}

/**
 * One workbook per supplier with only the lines it won: green cells with a
 * positive price for products that still have a quantity. Suppliers that won
 * nothing get no file.
 */
export function buildFinalOrderFiles({
  orderId,
  products,
  suppliers,
  quantities,
  prices,
  date = new Date(),
}: {
  orderId: string;
  products: Named[];
  suppliers: Named[];
  quantities: Quantities;
  prices: HistoryPrice;
  date?: Date;
}): ExcelFileData[] {
  const lines = orderedProducts(products, quantities);
  return suppliers
    .map((supplier): ExcelFileData => {
      const productIds: string[] = [];
      const rows: (string | number)[][] = [];
      lines.forEach((product) => {
        const cell =
          prices[
            priceHash({
              orderId,
              productId: product.id,
              supplierId: supplier.id,
            })
          ];
        if (
          cell?.color === OrderPriceColor.green &&
          cell.value != null &&
          cell.value > 0
        ) {
          rows.push([product.name, quantities[product.id], cell.value]);
          productIds.push(product.id);
        }
      });
      return {
        filename: finalOrderFilename(supplier.name, date),
        data: [[...ORDER_FILE_HEADER], ...rows],
        supplierId: supplier.id,
        productIds,
      };
    })
    .filter((file) => file.data.length > 1);
}

// --- progress counters for the stepper ---

interface Grid {
  orderId: string;
  productIds: string[];
  supplierIds: string[];
  prices: HistoryPrice;
}

const cellsOf = ({ orderId, productIds, supplierIds, prices }: Grid) =>
  productIds.map((productId) =>
    supplierIds.map(
      (supplierId) => prices[priceHash({ orderId, productId, supplierId })],
    ),
  );

const isPriced = (cell: HistoryPrice[string] | undefined) =>
  cell?.value != null && !Number.isNaN(cell.value);

/** Cells (product x supplier) that have a price. */
export function countFilledPrices(grid: Grid): number {
  return cellsOf(grid).flat().filter(isPriced).length;
}

/** Products where some supplier's price is marked cheapest (green). */
export function countCheapestFound(grid: Grid): number {
  return cellsOf(grid).filter((row) =>
    row.some((cell) => isPriced(cell) && cell?.color === OrderPriceColor.green),
  ).length;
}

/** Priced cells without a colour: uploaded/edited after the last calculation. */
export function hasUncalculatedPrices(grid: Grid): boolean {
  return cellsOf(grid)
    .flat()
    .some((cell) => isPriced(cell) && cell?.color == null);
}

// --- reading filled files ---

/**
 * A price cell as a number: plain numbers, formula results, and text such as
 * "3,67", "1 250.5" or "950 TMT" (Russian keyboards type a comma). Undefined
 * when empty or not a number.
 */
export function parsePriceCell(value: ExcelJS.CellValue): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'object') {
    if ('result' in value) {
      return parsePriceCell(value.result as ExcelJS.CellValue);
    }
    if ('richText' in value) {
      return parsePriceCell(value.richText.map(({ text }) => text).join(''));
    }
    return undefined;
  }
  if (typeof value !== 'string') return undefined;
  // Drop spaces, currency signs and units ("1 200 $", "950 TMT").
  let text = value.replace(/[^\d.,-]/g, '');
  // "1,250.50" / "1,250,000" -> thousands commas; "3,67" -> decimal comma.
  const commas = (text.match(/,/g) ?? []).length;
  text =
    text.includes('.') || commas > 1
      ? text.replace(/,/g, '')
      : text.replace(',', '.');
  if (!/^-?\d*\.?\d+$/.test(text)) return undefined;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export type UploadFileError = 'unreadable' | 'notThisOrder' | 'noPrices';

export interface UploadFileResult {
  fileName: string;
  supplierId?: string;
  /** Prices taken from this file. */
  imported: number;
  error?: UploadFileError;
}

export interface UploadResult {
  /** priceHash -> { value } for every imported price (no colour yet). */
  prices: HistoryPrice;
  files: UploadFileResult[];
}

type ReadableFile = Pick<File, 'name' | 'arrayBuffer'>;

/**
 * Reads one filled workbook. IDs sheet
 * row 2 holds the supplier id, IDs row N+1 the product of Order row N+1.
 * Prices keep their decimals; empty, non-numeric and non-positive prices are
 * skipped (a store writing 0 for "don't have it" must not win the
 * calculation). Lines for suppliers/products that aren't in the order are
 * ignored so stale files can't write prices into it.
 */
export async function readFilledOrderFile(
  orderId: string,
  file: ReadableFile,
  scope: { supplierIds: string[]; productIds: string[] },
): Promise<{ result: UploadFileResult; prices: HistoryPrice }> {
  const prices: HistoryPrice = {};
  const fail = (error: UploadFileError, supplierId?: string) => ({
    result: { fileName: file.name, supplierId, imported: 0, error },
    prices,
  });

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return fail('unreadable');
  }
  const idsSheet = workbook.getWorksheet(IDS_SHEET_NAME);
  const orderSheet = workbook.getWorksheet(ORDER_SHEET_NAME);
  if (!idsSheet || !orderSheet) return fail('unreadable');

  let supplierId = '';
  const productIds: string[] = [];
  idsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values as ExcelJS.CellValue[];
    if (rowNumber === 2) supplierId = String(values[1] ?? '');
    productIds[rowNumber - 2] = String(values[2] ?? '');
  });
  if (!supplierId) return fail('unreadable');
  if (!scope.supplierIds.includes(supplierId)) {
    return fail('notThisOrder', supplierId);
  }

  const inOrder = new Set(scope.productIds);
  orderSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const productId = productIds[rowNumber - 2];
    if (!productId || !inOrder.has(productId)) return;
    const value = parsePriceCell(row.getCell(3).value);
    if (value == null || value <= 0) return;
    prices[priceHash({ orderId, productId, supplierId })] = { value };
  });

  const imported = Object.keys(prices).length;
  if (imported === 0) return fail('noPrices', supplierId);
  return { result: { fileName: file.name, supplierId, imported }, prices };
}

/** Reads every file; one bad file doesn't stop the others. */
export async function readFilledOrderFiles(
  orderId: string,
  files: ReadableFile[],
  scope: { supplierIds: string[]; productIds: string[] },
): Promise<UploadResult> {
  const read = await Promise.all(
    files.map((file) => readFilledOrderFile(orderId, file, scope)),
  );
  return {
    prices: Object.assign({}, ...read.map(({ prices }) => prices)),
    files: read.map(({ result }) => result),
  };
}

// --- delivery (browser only) ---

export const xlsxFilename = (filename: string) =>
  filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;

/** Builds one workbook as a File (shareable and downloadable). */
export async function toXlsxFile(data: ExcelFileData): Promise<File | null> {
  const blob = await xlsxBlobFromFileData(data);
  return blob
    ? new File([blob], xlsxFilename(data.filename), { type: XLSX_MIME_TYPE })
    : null;
}

/** Builds the workbooks, skipping any ExcelJS failed on. */
export async function toXlsxFiles(files: ExcelFileData[]): Promise<File[]> {
  const built = await Promise.all(files.map(toXlsxFile));
  return built.filter((file): file is File => file != null);
}

/** True when the Web Share API can send these files (phones, mostly). */
export function canShareFiles(files: File[]): boolean {
  if (typeof navigator === 'undefined' || files.length === 0) return false;
  try {
    return (
      typeof navigator.share === 'function' &&
      navigator.canShare?.({ files }) === true
    );
  } catch {
    return false;
  }
}

/**
 * Opens the system share sheet. Must run straight from a tap (browsers need
 * the user gesture), so build the files before the user presses "Share".
 */
export async function shareFiles(
  files: File[],
  title?: string,
): Promise<'shared' | 'cancelled' | 'failed'> {
  try {
    await navigator.share({ files, title });
    return 'shared';
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') return 'cancelled';
    console.error('Share failed:', error);
    return 'failed';
  }
}

/** Saves each file through a temporary <a download>, one after another. */
export async function downloadFiles(files: File[]): Promise<void> {
  // eslint-disable-next-line no-restricted-syntax
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    // Safari drops downloads fired back to back.
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
  }
}
