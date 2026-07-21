import type {
  BulkImportBody,
  BulkProductExportRow,
  BulkVariant,
  ImportProductRow,
  ImportVariantRow,
} from '@/pages/api/product/bulk.page';
import * as ExcelJS from 'exceljs';

export const PRODUCTS_SHEET_NAME = 'Products';
export const VARIANTS_SHEET_NAME = 'Variants';
export const LISTS_SHEET_NAME = 'Lists';
export const MISSING_PRODUCTS_SHEET_ERROR = 'MISSING_PRODUCTS_SHEET';

const PRODUCTS_HEADER = [
  'ID',
  'Slug',
  'Category Slug',
  'Brand',
  'Price USD',
  'Price TMT',
  'Out of Stock',
  'Video URLs',
];

const VARIANTS_HEADER = [
  'Product ID',
  'Product Name',
  'Spec',
  'Price USD',
  'Price TMT',
  'Color',
];

// True if the cell still holds the auto-calc TMT formula (untouched by the
// admin). A cell the admin typed a literal number/text over is no longer a
// formula, so this returns false and the literal value wins on import.
export function isFormulaCell(value: ExcelJS.CellValue): boolean {
  return (
    typeof value === 'object' &&
    value != null &&
    !(value instanceof Date) &&
    'formula' in value
  );
}

// Normalize any ExcelJS cell value (null, number, boolean, Date, richText,
// hyperlink, formula result) to a plain trimmed string.
export function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('richText' in value) {
      return value.richText
        .map((part) => part.text)
        .join('')
        .trim();
    }
    if ('text' in value) return cellText(value.text as ExcelJS.CellValue);
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    if ('error' in value) return '';
  }
  return String(value).trim();
}

// Same styling as procurement's arrayToXlsxBlob (bold header + width autosize),
// deliberately without its hidden supplier IDs sheet.
function styleSheet(worksheet: ExcelJS.Worksheet) {
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const columnLength = cell.value ? cell.text.length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = maxLength < 10 ? 10 : maxLength + 1;
  });
  worksheet.getRow(1).font = { bold: true };
}

// TMT cell for a given USD column/row: a live formula when a rate is known
// (admins overwrite it to pin a manual TMT price), otherwise the plain
// last-known value.
function tmtCell(
  usdCol: string,
  row: number,
  usd: string,
  tmt: string,
  rate: number | null,
): ExcelJS.CellValue {
  if (rate == null || usd === '') return tmt;
  return { formula: `ROUNDUP(${usdCol}${row}*${rate},0)` };
}

// Excel dropdown backed by a range on the hidden Lists sheet. showErrorMessage
// + errorStyle 'stop' makes Excel *reject* any value not in the list (typed or
// pasted), not just offer the dropdown — so admins can't invent a category or
// brand. allowBlank leaves a cell untouched (empty = "no change" on import).
function listValidation(
  what: string,
  column: 'A' | 'B',
  count: number,
): ExcelJS.DataValidation {
  return {
    type: 'list',
    allowBlank: true,
    formulae: [`${LISTS_SHEET_NAME}!$${column}$2:$${column}$${count + 1}`],
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: `Invalid ${what}`,
    error: `Pick an existing ${what} from the dropdown. New ${what}s must be created in the app first.`,
  };
}

export async function buildWorkbookBlob(
  products: BulkProductExportRow[],
  variants: BulkVariant[],
  rate: number | null,
  categorySlugs: string[],
  brands: string[],
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WebClient';
  workbook.created = new Date();

  // Hidden sheet holding the allowed values the dropdowns point at.
  const listsSheet = workbook.addWorksheet(LISTS_SHEET_NAME);
  listsSheet.state = 'veryHidden';
  categorySlugs.forEach((slug, i) => {
    listsSheet.getCell(i + 2, 1).value = slug;
  });
  brands.forEach((brand, i) => {
    listsSheet.getCell(i + 2, 2).value = brand;
  });

  const productsSheet = workbook.addWorksheet(PRODUCTS_SHEET_NAME);
  productsSheet.addRow(PRODUCTS_HEADER);
  products.forEach((product, index) => {
    const row = index + 2;
    productsSheet.addRow([
      product.id,
      product.slug,
      product.categorySlug,
      product.brand,
      product.priceUsd,
      tmtCell('E', row, product.priceUsd, product.priceTmt, rate),
      product.isOutOfStock ? 'TRUE' : 'FALSE',
      product.videoUrls,
    ]);
    if (categorySlugs.length > 0) {
      productsSheet.getCell(`C${row}`).dataValidation = listValidation(
        'category',
        'A',
        categorySlugs.length,
      );
    }
    if (brands.length > 0) {
      productsSheet.getCell(`D${row}`).dataValidation = listValidation(
        'brand',
        'B',
        brands.length,
      );
    }
  });
  styleSheet(productsSheet);

  const variantsSheet = workbook.addWorksheet(VARIANTS_SHEET_NAME);
  variantsSheet.addRow(VARIANTS_HEADER);
  variants.forEach((variant, index) => {
    const row = index + 2;
    variantsSheet.addRow([
      variant.productId,
      variant.productName,
      variant.spec,
      variant.priceUsd,
      tmtCell('D', row, variant.priceUsd, variant.priceTmt, rate),
      variant.color,
    ]);
  });
  styleSheet(variantsSheet);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// An untouched auto-calc formula means "no explicit TMT" -> derive fresh
// from USD + the current rate on import, rather than trusting the formula's
// (possibly stale, unrecalculated) cached result.
function tmtCellText(value: ExcelJS.CellValue): string {
  return isFormulaCell(value) ? '' : cellText(value);
}

export async function parseWorkbook(file: File): Promise<BulkImportBody> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const productsSheet = workbook.getWorksheet(PRODUCTS_SHEET_NAME);
  if (productsSheet == null) {
    throw new Error(MISSING_PRODUCTS_SHEET_ERROR);
  }

  const products: ImportProductRow[] = [];
  productsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const id = cellText(row.getCell(1).value);
    if (id === '') return; // blank / decorative row
    products.push({
      row: rowNumber,
      id,
      categorySlug: cellText(row.getCell(3).value),
      brand: cellText(row.getCell(4).value),
      priceUsd: cellText(row.getCell(5).value),
      priceTmt: tmtCellText(row.getCell(6).value),
      outOfStock: cellText(row.getCell(7).value),
      videoUrls: cellText(row.getCell(8).value),
    });
  });

  const variantsSheet = workbook.getWorksheet(VARIANTS_SHEET_NAME);
  const variants: ImportVariantRow[] = [];
  if (variantsSheet != null) {
    variantsSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const productId = cellText(row.getCell(1).value);
      if (productId === '') return;
      variants.push({
        row: rowNumber,
        productId,
        spec: cellText(row.getCell(3).value),
        priceUsd: cellText(row.getCell(4).value),
        priceTmt: tmtCellText(row.getCell(5).value),
        color: cellText(row.getCell(6).value),
      });
    });
  }

  return { products, variants, hasVariantsSheet: variantsSheet != null };
}
