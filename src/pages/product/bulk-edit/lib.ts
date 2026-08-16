import type {
  BulkImportBody,
  BulkPriceCategory,
  BulkProductExportRow,
  BulkVariant,
  ImportProductRow,
  ImportVariantRow,
} from '@/pages/api/product/bulk.page';
import { squareBracketRegex } from '@/pages/lib/constants';
import { tmtFromUsd } from '@/pages/product/utils';
import {
  bannerFont,
  fillRow,
  HEADER_FILL,
  NESTED_BANNER_FILL,
  PATH_SEPARATOR,
  ROOT_BANNER_FILL,
} from '@/pages/product/xlsxBanner';
import * as ExcelJS from 'exceljs';

export const PRODUCTS_SHEET_NAME = 'Products';
export const VARIANTS_SHEET_NAME = 'Variants';
export const LISTS_SHEET_NAME = 'Lists';
export const MISSING_PRODUCTS_SHEET_ERROR = 'MISSING_PRODUCTS_SHEET';

/** Banner for prices belonging to no category — always last, always present. */
export const UNCATEGORIZED_LABEL = 'Uncategorized';

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
  'Price ID',
  'Product ID',
  'Product Name',
  'Spec',
  'Price USD',
  'Price TMT',
  'Color',
];

const VARIANTS_LAST_COLUMN = VARIANTS_HEADER.length;

// Columns an admin may type into. Everything else is machine identity: the IDs
// rows are matched on, and the product name shown only to make a row readable.
const PRODUCTS_EDITABLE_COLUMNS = [3, 4, 5, 6, 7, 8];
const VARIANTS_EDITABLE_COLUMNS = [4, 5, 6, 7];

/**
 * Width for the UUID columns. Nobody reads a uuid, and autosizing them to their
 * 36 characters pushes the columns that are actually edited off the screen, so
 * they are squeezed to a stub instead. The value stays in the cell, just
 * clipped — the neighbouring column holds text, which is what stops Excel
 * overflowing the id across it.
 */
export const ID_COLUMN_WIDTH = 5;

// Slug and Product Name sit right beside them and are what makes a row
// recognizable to a person, so they keep their full autosized width.
const PRODUCTS_ID_COLUMNS = [1];
const VARIANTS_ID_COLUMNS = [1, 2];

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
}

// Runs after styleSheet, whose autosize would otherwise win.
function narrowIdColumns(sheet: ExcelJS.Worksheet, columns: number[]) {
  columns.forEach((column) => {
    sheet.getColumn(column).width = ID_COLUMN_WIDTH;
  });
}

function unlock(sheet: ExcelJS.Worksheet, row: number, columns: number[]) {
  columns.forEach((column) => {
    sheet.getCell(row, column).protection = { locked: false };
  });
}

// TMT cell for a given USD column/row: a live formula when a rate is known
// (admins overwrite it to pin a manual TMT price), otherwise the plain
// last-known value.
//
// A stored TMT that the formula would not reproduce was pinned by hand — an
// admin typing manat gets a USD back-computed to 2 decimals, and that rounded
// USD times the rate lands just above the typed manat, so ROUNDUP adds 1. Such
// a price is exported as a literal, otherwise re-uploading an untouched sheet
// silently raises it by a manat every time.
function tmtCell(
  usdCol: string,
  row: number,
  usd: string,
  tmt: string,
  rate: number | null,
): ExcelJS.CellValue {
  if (rate == null || usd === '') return tmt;
  if (tmt !== '' && tmtFromUsd(Number(usd), rate) !== Number(tmt)) return tmt;
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

export interface VariantSection {
  slug: string; // '' = the Uncategorized section
  label: string; // banner text, slug included for the parser to read back
  depth: number; // 0 = a root category, deeper = a subcategory tint
  variants: BulkVariant[];
}

/**
 * Lays the Variants sheet out as one section per category, in the order the
 * categories arrive (already depth-first from the API), with Uncategorized
 * last.
 *
 * Every category gets a section even with no prices in it: the banner a row
 * sits under IS its category, so a category with no banner would be a category
 * no price could ever be moved into.
 */
export function buildVariantSections(
  variants: BulkVariant[],
  priceCategories: BulkPriceCategory[],
): VariantSection[] {
  const bySlug = new Map<string, BulkVariant[]>();
  priceCategories.forEach((category) => bySlug.set(category.slug, []));
  bySlug.set('', []);
  variants.forEach((variant) => {
    // A slug that no longer exists falls back to Uncategorized rather than
    // vanishing from the sheet.
    (bySlug.get(variant.categorySlug) ?? bySlug.get('')!).push(variant);
  });

  const sorted = (slug: string) =>
    [...bySlug.get(slug)!].sort((a, b) => a.spec.localeCompare(b.spec));

  return [
    ...priceCategories.map((category) => ({
      slug: category.slug,
      label: `${category.path.join(PATH_SEPARATOR)} [${category.slug}]`,
      depth: category.path.length - 1,
      variants: sorted(category.slug),
    })),
    {
      slug: '',
      label: UNCATEGORIZED_LABEL,
      depth: 0,
      variants: sorted(''),
    },
  ];
}

function writeVariantsSheet(
  sheet: ExcelJS.Worksheet,
  sections: VariantSection[],
  rate: number | null,
) {
  let row = 1;
  sections.forEach((section, index) => {
    if (index > 0) row += 1; // blank row between sections

    const isRoot = section.depth === 0;
    // Not merged, unlike the price-list sheet: the parser tells a banner from a
    // data row by the rest of the row being empty, and a merge would hand every
    // cell in the row the banner's text. Excel overflows the text across the
    // empty cells anyway, so it reads the same.
    fillRow(
      sheet,
      row,
      VARIANTS_LAST_COLUMN,
      isRoot ? ROOT_BANNER_FILL : NESTED_BANNER_FILL,
    );
    sheet.getCell(row, 1).value = section.label;
    sheet.getCell(row, 1).font = bannerFont(isRoot);
    row += 1;

    // Repeated per section so the columns stay readable far down the sheet.
    fillRow(sheet, row, VARIANTS_LAST_COLUMN, HEADER_FILL);
    VARIANTS_HEADER.forEach((header, index_) => {
      const cell = sheet.getCell(row, index_ + 1);
      cell.value = header;
      cell.font = { bold: true };
    });
    row += 1;

    section.variants.forEach((variant) => {
      sheet.getCell(row, 1).value = variant.priceId;
      sheet.getCell(row, 2).value = variant.productId;
      sheet.getCell(row, 3).value = variant.productName;
      sheet.getCell(row, 4).value = variant.spec;
      sheet.getCell(row, 5).value = variant.priceUsd;
      sheet.getCell(row, 6).value = tmtCell(
        'E',
        row,
        variant.priceUsd,
        variant.priceTmt,
        rate,
      );
      sheet.getCell(row, 7).value = variant.color;
      unlock(sheet, row, VARIANTS_EDITABLE_COLUMNS);
      row += 1;
    });
  });
}

export interface WorkbookInput {
  products: BulkProductExportRow[];
  variants: BulkVariant[];
  rate: number | null;
  categorySlugs: string[];
  brands: string[];
  priceCategories: BulkPriceCategory[];
}

export async function buildWorkbookBlob({
  products,
  variants,
  rate,
  categorySlugs,
  brands,
  priceCategories,
}: WorkbookInput): Promise<Blob> {
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
  productsSheet.getRow(1).font = { bold: true };
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
    unlock(productsSheet, row, PRODUCTS_EDITABLE_COLUMNS);
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
  narrowIdColumns(productsSheet, PRODUCTS_ID_COLUMNS);

  const variantsSheet = workbook.addWorksheet(VARIANTS_SHEET_NAME);
  writeVariantsSheet(
    variantsSheet,
    buildVariantSections(variants, priceCategories),
    rate,
  );
  styleSheet(variantsSheet);
  narrowIdColumns(variantsSheet, VARIANTS_ID_COLUMNS);

  // Locked cells are Excel's default, so protecting the sheet freezes
  // everything the loops above did not explicitly unlock: the IDs rows are
  // matched on, and the slug. It is a guardrail against a stray fill-drag, not
  // a security boundary — the import ignores Slug and rejects unknown IDs
  // regardless of what the sheet allowed.
  await productsSheet.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: true,
    formatColumns: true,
    formatRows: true,
    insertRows: true,
    deleteRows: true,
    sort: true,
    autoFilter: true,
  });
  // Sorting and filtering stay off here: a row's position is what says which
  // category its price belongs to, so an Excel sort would silently recategorize
  // the whole sheet. Inserting rows stays on — that is how a price is added.
  await variantsSheet.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: true,
    formatColumns: true,
    formatRows: true,
    insertRows: true,
    deleteRows: true,
    sort: false,
    autoFilter: false,
  });

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

/**
 * The category a banner row names, or undefined if the row is not a banner.
 *
 * Only the bracketed slug and the exact Uncategorized label count. Anything
 * else sitting alone in column A is somebody's note, and reading it as a
 * category would silently re-file every row beneath it.
 */
function bannerSlug(text: string): string | undefined {
  const slug = text.match(squareBracketRegex)?.[1];
  if (slug != null) return slug.trim();
  return text === UNCATEGORIZED_LABEL ? '' : undefined;
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
    // The section the walk is currently inside. Undefined until the first
    // banner: rows above every banner belong to no category anyone chose, which
    // the server reports rather than guessing at.
    let sectionSlug: string | undefined;
    variantsSheet.eachRow((row, rowNumber) => {
      const cells = VARIANTS_HEADER.map((_, index) => row.getCell(index + 1));
      const texts = cells.map((cell) => cellText(cell.value));
      if (texts.every((text) => text === '')) return; // separator
      if (texts[0] === VARIANTS_HEADER[0]) return; // a section's header row

      if (texts.slice(1).every((text) => text === '')) {
        const slug = bannerSlug(texts[0]);
        if (slug != null) sectionSlug = slug;
        return; // a banner, or a decorative row that names no category
      }

      variants.push({
        row: rowNumber,
        priceId: texts[0],
        productId: texts[1],
        spec: texts[3],
        priceUsd: texts[4],
        priceTmt: tmtCellText(cells[5].value),
        color: texts[6],
        ...(sectionSlug === undefined ? {} : { categorySlug: sectionSlug }),
      });
    });
  }

  return { products, variants, hasVariantsSheet: variantsSheet != null };
}
