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
export const MISSING_PRODUCTS_SHEET_ERROR = 'MISSING_PRODUCTS_SHEET';

const PRODUCTS_HEADER = [
  'ID',
  'Slug',
  'Name EN',
  'Name TK',
  'Name RU',
  'Name CH',
  'Name TR',
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
      const columnLength = cell.value ? String(cell.value).length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = maxLength < 10 ? 10 : maxLength + 1;
  });
  worksheet.getRow(1).font = { bold: true };
}

export async function buildWorkbookBlob(
  products: BulkProductExportRow[],
  variants: BulkVariant[],
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WebClient';
  workbook.created = new Date();

  const productsSheet = workbook.addWorksheet(PRODUCTS_SHEET_NAME);
  productsSheet.addRow(PRODUCTS_HEADER);
  products.forEach((product) => {
    productsSheet.addRow([
      product.id,
      product.slug,
      product.nameEn,
      product.nameTk,
      product.nameRu,
      product.nameCh,
      product.nameTr,
      product.categorySlug,
      product.brand,
      product.priceUsd,
      product.priceTmt,
      product.isOutOfStock ? 'TRUE' : 'FALSE',
      product.videoUrls,
    ]);
  });
  styleSheet(productsSheet);

  const variantsSheet = workbook.addWorksheet(VARIANTS_SHEET_NAME);
  variantsSheet.addRow(VARIANTS_HEADER);
  variants.forEach((variant) => {
    variantsSheet.addRow([
      variant.productId,
      variant.productName,
      variant.spec,
      variant.priceUsd,
      variant.priceTmt,
      variant.color,
    ]);
  });
  styleSheet(variantsSheet);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
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
      nameEn: cellText(row.getCell(3).value),
      nameTk: cellText(row.getCell(4).value),
      nameRu: cellText(row.getCell(5).value),
      nameCh: cellText(row.getCell(6).value),
      nameTr: cellText(row.getCell(7).value),
      categorySlug: cellText(row.getCell(8).value),
      brand: cellText(row.getCell(9).value),
      priceUsd: cellText(row.getCell(10).value),
      priceTmt: cellText(row.getCell(11).value),
      outOfStock: cellText(row.getCell(12).value),
      videoUrls: cellText(row.getCell(13).value),
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
        priceTmt: cellText(row.getCell(5).value),
        color: cellText(row.getCell(6).value),
      });
    });
  }

  return { products, variants, hasVariantsSheet: variantsSheet != null };
}
