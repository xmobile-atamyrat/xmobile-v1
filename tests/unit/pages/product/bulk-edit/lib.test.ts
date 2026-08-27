import * as ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import type {
  BulkPriceCategory,
  BulkProductExportRow,
  BulkVariant,
} from '@/pages/api/product/bulk.page';
import {
  buildVariantSections,
  buildWorkbookBlob,
  cellText,
  parseWorkbook,
  PRODUCTS_SHEET_NAME,
  ID_COLUMN_WIDTH,
  UNCATEGORIZED_LABEL,
  VARIANTS_SHEET_NAME,
} from '@/pages/product/bulk-edit/lib';

const product = (over: Partial<BulkProductExportRow> = {}) => ({
  id: 'p1',
  slug: 'p1',
  categorySlug: 'phones',
  brand: 'Apple',
  priceUsd: '100',
  priceTmt: '1960',
  isOutOfStock: false,
  videoUrls: '',
  ...over,
});

const variant = (over: Partial<BulkVariant> = {}): BulkVariant => ({
  priceId: 'pr1',
  productId: '',
  productName: '',
  spec: '128GB',
  priceUsd: '100',
  priceTmt: '1960',
  color: '',
  categorySlug: 'phones',
  ...over,
});

const categories: BulkPriceCategory[] = [
  { slug: 'phones', path: ['Phones'] },
  { slug: 'apple-phones', path: ['Phones', 'Apple'] },
];

const build = (
  over: Partial<Parameters<typeof buildWorkbookBlob>[0]> = {},
): Promise<Blob> =>
  buildWorkbookBlob({
    products: [product()],
    variants: [],
    rate: 19.6,
    categorySlugs: ['phones'],
    brands: ['Apple'],
    priceCategories: categories,
    ...over,
  });

// ExcelJS reads sheetProtection back off the file but does not declare it.
type ProtectedSheet = ExcelJS.Worksheet & {
  sheetProtection?: {
    sheet?: boolean;
    sort?: boolean;
    autoFilter?: boolean;
    insertRows?: boolean;
  };
};

const loadSheet = async (blob: Blob, name: string): Promise<ProtectedSheet> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  return workbook.getWorksheet(name)! as ProtectedSheet;
};

const fileFrom = async (blob: Blob) =>
  new File([await blob.arrayBuffer()], 'x.xlsx');

/** Raw Variants sheet, so parser rules can be tested without the builder. */
const variantsSheetFile = async (
  rows: (string | number | null)[][],
): Promise<File> => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet(PRODUCTS_SHEET_NAME);
  const sheet = workbook.addWorksheet(VARIANTS_SHEET_NAME);
  rows.forEach((row) => sheet.addRow(row));
  return new File([await workbook.xlsx.writeBuffer()], 'x.xlsx');
};

describe('buildVariantSections', () => {
  it('groups prices under their category, in the order the categories arrive', () => {
    const sections = buildVariantSections(
      [
        variant({ priceId: 'a', categorySlug: 'apple-phones' }),
        variant({ priceId: 'b', categorySlug: 'phones' }),
      ],
      categories,
    );

    expect(sections.map((section) => section.slug)).toEqual([
      'phones',
      'apple-phones',
      '',
    ]);
    expect(sections[0].variants.map((row) => row.priceId)).toEqual(['b']);
    expect(sections[1].variants.map((row) => row.priceId)).toEqual(['a']);
  });

  it('emits a banner for a category with no prices, so a price can be moved into it', () => {
    const sections = buildVariantSections(
      [variant({ categorySlug: 'phones' })],
      categories,
    );

    const empty = sections.find((section) => section.slug === 'apple-phones');
    expect(empty).toBeDefined();
    expect(empty!.variants).toHaveLength(0);
  });

  it('collects prices with no category into a trailing Uncategorized section', () => {
    const sections = buildVariantSections(
      [variant({ priceId: 'loose', categorySlug: '' })],
      categories,
    );

    const last = sections[sections.length - 1];
    expect(last.slug).toBe('');
    expect(last.label).toBe(UNCATEGORIZED_LABEL);
    expect(last.variants.map((row) => row.priceId)).toEqual(['loose']);
  });

  it('labels a section with its full category path and the slug the parser reads back', () => {
    const sections = buildVariantSections([], categories);

    expect(sections[1].label).toBe('Phones > Apple [apple-phones]');
  });
});

describe('bulk-edit Variants sheet round-trip', () => {
  it('reads a pool row back with its price ID and the category of the banner above it', async () => {
    const blob = await build({
      variants: [
        variant({
          priceId: 'pr9',
          categorySlug: 'apple-phones',
          spec: '256GB',
        }),
      ],
    });
    const parsed = await parseWorkbook(await fileFrom(blob));

    expect(parsed.variants).toHaveLength(1);
    expect(parsed.variants[0]).toMatchObject({
      priceId: 'pr9',
      productId: '',
      spec: '256GB',
      categorySlug: 'apple-phones',
    });
  });

  it('takes the category from the banner a row sits under, not from where it was exported', async () => {
    const file = await variantsSheetFile([
      ['Phones [phones]'],
      ['Price ID', 'Product ID', 'Product Name', 'Spec', 'USD', 'TMT', 'Color'],
      ['pr1', '', '', '128GB', 100, 1960, ''],
      [],
      ['Phones > Apple [apple-phones]'],
      ['Price ID', 'Product ID', 'Product Name', 'Spec', 'USD', 'TMT', 'Color'],
      ['pr2', '', '', '256GB', 200, 3920, ''],
    ]);

    const parsed = await parseWorkbook(file);

    expect(
      parsed.variants.map((row) => [row.priceId, row.categorySlug]),
    ).toEqual([
      ['pr1', 'phones'],
      ['pr2', 'apple-phones'],
    ]);
  });

  it('reads a row under the Uncategorized banner as having no category', async () => {
    const file = await variantsSheetFile([
      [UNCATEGORIZED_LABEL],
      ['Price ID', 'Product ID', 'Product Name', 'Spec', 'USD', 'TMT', 'Color'],
      ['pr1', '', '', '128GB', 100, 1960, ''],
    ]);

    const parsed = await parseWorkbook(file);

    expect(parsed.variants[0].categorySlug).toBe('');
  });

  it('leaves categorySlug undefined for a row that sits under no banner at all', async () => {
    const file = await variantsSheetFile([
      ['Price ID', 'Product ID', 'Product Name', 'Spec', 'USD', 'TMT', 'Color'],
      ['pr1', '', '', '128GB', 100, 1960, ''],
    ]);

    const parsed = await parseWorkbook(file);

    expect(parsed.variants).toHaveLength(1);
    expect(parsed.variants[0].categorySlug).toBeUndefined();
  });

  it('skips a decorative row that names no category instead of treating it as a banner', async () => {
    const file = await variantsSheetFile([
      ['Phones [phones]'],
      ['Price ID', 'Product ID', 'Product Name', 'Spec', 'USD', 'TMT', 'Color'],
      ['just a note'],
      ['pr1', '', '', '128GB', 100, 1960, ''],
    ]);

    const parsed = await parseWorkbook(file);

    expect(parsed.variants).toHaveLength(1);
    expect(parsed.variants[0].categorySlug).toBe('phones');
  });

  it('keeps a product-attached row attached, with its product ID and name intact', async () => {
    const blob = await build({
      variants: [
        variant({
          priceId: 'pr3',
          productId: 'p1',
          productName: 'iPhone 15',
          color: 'Black',
        }),
      ],
    });
    const parsed = await parseWorkbook(await fileFrom(blob));

    expect(parsed.variants[0]).toMatchObject({
      priceId: 'pr3',
      productId: 'p1',
      color: 'Black',
    });
  });
});

describe('bulk-edit ID column width', () => {
  it('squeezes the Products ID column while leaving Slug readable', async () => {
    const sheet = await loadSheet(
      await build({
        products: [product({ id: '0f4f2a9e-3c6d-4a1b-9f77-2b3c4d5e6f70' })],
      }),
      PRODUCTS_SHEET_NAME,
    );

    expect(sheet.getColumn(1).width).toBeLessThanOrEqual(ID_COLUMN_WIDTH);
    expect(sheet.getColumn(2).width).toBeGreaterThan(ID_COLUMN_WIDTH);
  });

  it('squeezes both ID columns on the Variants sheet, not Product Name', async () => {
    const sheet = await loadSheet(
      await build({
        variants: [
          variant({
            priceId: '0f4f2a9e-3c6d-4a1b-9f77-2b3c4d5e6f70',
            productId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
            productName: 'iPhone 15 Pro Max',
          }),
        ],
      }),
      VARIANTS_SHEET_NAME,
    );

    expect(sheet.getColumn(1).width).toBeLessThanOrEqual(ID_COLUMN_WIDTH);
    expect(sheet.getColumn(2).width).toBeLessThanOrEqual(ID_COLUMN_WIDTH);
    expect(sheet.getColumn(3).width).toBeGreaterThan(ID_COLUMN_WIDTH);
  });
});

describe('bulk-edit sheet protection', () => {
  it('locks ID and Slug on the Products sheet and leaves the editable columns open', async () => {
    const sheet = await loadSheet(await build(), PRODUCTS_SHEET_NAME);

    expect(sheet.getCell('A2').protection?.locked).not.toBe(false);
    expect(sheet.getCell('B2').protection?.locked).not.toBe(false);
    expect(sheet.getCell('C2').protection?.locked).toBe(false);
    expect(sheet.getCell('G2').protection?.locked).toBe(false);
    expect(sheet.sheetProtection?.sheet).toBe(true);
  });

  // Price ID is the only identity on this sheet. Product ID is editable on
  // purpose — retyping it is how a price is moved to another product, and the
  // import validates it against the Products sheet rather than trusting it.
  it('locks Price ID on the Variants sheet and leaves the rest of the row open', async () => {
    const blob = await build({ variants: [variant()] });
    const sheet = await loadSheet(blob, VARIANTS_SHEET_NAME);
    const row = sheet.getRow(3); // banner, header, first data row

    expect(row.getCell(1).protection?.locked).not.toBe(false); // Price ID
    expect(row.getCell(2).protection?.locked).toBe(false); // Product ID
    expect(row.getCell(3).protection?.locked).toBe(false); // Product Name
    expect(row.getCell(4).protection?.locked).toBe(false); // Spec
    expect(row.getCell(5).protection?.locked).toBe(false); // USD
  });

  it('blocks sorting the Variants sheet, because row position carries the category', async () => {
    const sheet = await loadSheet(await build(), VARIANTS_SHEET_NAME);

    expect(sheet.sheetProtection?.sort).not.toBe(true);
    expect(sheet.sheetProtection?.autoFilter).not.toBe(true);
  });

  it('still allows adding a row, which is how a new price is created', async () => {
    const sheet = await loadSheet(await build(), VARIANTS_SHEET_NAME);

    expect(sheet.sheetProtection?.insertRows).toBe(true);
  });
});

// Excel's default is locked, so a cell is only editable on a protected sheet
// when locked is explicitly false. Absent protection === locked.
const editable = (sheet: ExcelJS.Worksheet, row: number, column: number) =>
  sheet.getCell(row, column).protection?.locked === false;

describe('bulk-edit protection leaves every non-identity cell editable', () => {
  // The unlock used to be applied per written cell, which meant Excel's default
  // lock survived everywhere the export never wrote: the blank rows between
  // sections, the whole region past the last row, and any row an admin inserts.
  // Clicking any of those and typing raised "this cell is on a protected sheet",
  // which also made insertRows: true useless — inserting a row is how a price
  // gets added.
  it('locks only ID and Slug on the Products sheet', async () => {
    const sheet = await loadSheet(await build(), PRODUCTS_SHEET_NAME);

    expect(editable(sheet, 2, 1)).toBe(false); // ID
    expect(editable(sheet, 2, 2)).toBe(false); // Slug
    [3, 4, 5, 6, 7, 8].forEach((column) => {
      expect(editable(sheet, 2, column)).toBe(true);
    });
  });

  it('keeps the Products sheet editable far below the last exported row', async () => {
    const sheet = await loadSheet(await build(), PRODUCTS_SHEET_NAME);

    [3, 4, 5, 6, 7, 8].forEach((column) => {
      expect(editable(sheet, 200, column)).toBe(true);
    });
    expect(editable(sheet, 200, 1)).toBe(false);
  });

  it('locks only Price ID on the Variants sheet', async () => {
    const sheet = await loadSheet(
      await build({ variants: [variant()] }),
      VARIANTS_SHEET_NAME,
    );
    const row = sheet.getColumn(1).values.indexOf('pr1');

    expect(editable(sheet, row, 1)).toBe(false); // Price ID
    [2, 3, 4, 5, 6, 7].forEach((column) => {
      expect(editable(sheet, row, column)).toBe(true);
    });
  });

  it('leaves the blank row between two sections editable', async () => {
    const sheet = await loadSheet(
      await build({ variants: [variant()] }),
      VARIANTS_SHEET_NAME,
    );
    // Row 3 is the first data row, so row 4 separates section one from two.
    expect(sheet.getCell(4, 1).value).toBeFalsy();
    [2, 3, 4, 5, 6, 7].forEach((column) => {
      expect(editable(sheet, 4, column)).toBe(true);
    });
  });

  it('keeps the Variants sheet editable far below the last exported row', async () => {
    const sheet = await loadSheet(
      await build({ variants: [variant()] }),
      VARIANTS_SHEET_NAME,
    );

    [2, 3, 4, 5, 6, 7].forEach((column) => {
      expect(editable(sheet, 200, column)).toBe(true);
    });
  });

  // Locking column 1 for the whole sheet is what keeps the layout's grammar
  // intact: a banner's "[slug]" label and a section header's "Price ID" marker
  // both sit in column 1, and the parser reads rows by their position under a
  // banner. Neither can be typed over even though the rest of the row is open.
  it('protects the banner label and the section header marker in column 1', async () => {
    const sheet = await loadSheet(
      await build({ variants: [variant()] }),
      VARIANTS_SHEET_NAME,
    );

    expect(sheet.getCell(1, 1).value).toContain('[phones]');
    expect(editable(sheet, 1, 1)).toBe(false); // banner label
    expect(sheet.getCell(2, 1).value).toBe('Price ID');
    expect(editable(sheet, 2, 1)).toBe(false); // header marker
  });
});

describe('bulk-edit workbook TMT formula round-trip', () => {
  it('exports an untouched TMT cell as a formula and reads it back as empty (auto-derive on import)', async () => {
    const parsed = await parseWorkbook(await fileFrom(await build()));

    expect(parsed.products).toHaveLength(1);
    expect(parsed.products[0].priceUsd).toBe('100');
    expect(parsed.products[0].priceTmt).toBe('');
  });

  it('preserves an admin override typed over the formula', async () => {
    const blob = await build();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const sheet = workbook.getWorksheet(PRODUCTS_SHEET_NAME)!;
    sheet.getCell('F2').value = 2400; // admin overwrites the formula with a literal

    const buffer = await workbook.xlsx.writeBuffer();
    const parsed = await parseWorkbook(new File([buffer], 'x.xlsx'));

    expect(parsed.products[0].priceTmt).toBe('2400');
  });

  it('exports a hand-pinned TMT as a literal so an untouched sheet re-imports as a no-op', async () => {
    // 370 manat typed by an admin back-computes to 18.88 USD, and
    // 18.88 * 19.6 = 370.048 rounds up to 371 — so a formula would silently
    // raise the pinned price by 1 on every round trip.
    const blob = await build({
      products: [product({ priceUsd: '18.88', priceTmt: '370' })],
    });
    const parsed = await parseWorkbook(await fileFrom(blob));

    expect(parsed.products[0].priceTmt).toBe('370');
  });

  it('falls back to the plain last-known TMT value when no rate is available', async () => {
    const parsed = await parseWorkbook(
      await fileFrom(await build({ rate: null })),
    );

    expect(parsed.products[0].priceTmt).toBe('1960');
  });

  it('derives a variant TMT from the shifted USD column after the Price ID insert', async () => {
    const blob = await build({ variants: [variant()] });
    const parsed = await parseWorkbook(await fileFrom(blob));

    expect(parsed.variants[0].priceUsd).toBe('100');
    expect(parsed.variants[0].priceTmt).toBe('');
  });
});

// 18.5 * 19.6 = 362.6 -> 363, so the TMT cell stays an auto-calc formula and
// its USD operand is what the reader's Excel has to multiply.
const DECIMAL_USD = { priceUsd: '18.5', priceTmt: '363' };

describe('bulk-edit USD cell is numeric, not text', () => {
  // Prices.price is a String column, and writing that string straight into the
  // cell made Excel coerce text -> number *using the reader's regional decimal
  // separator*. On a comma-decimal locale (ru-RU) "18.5" is not a number, so
  // ROUNDUP(E2*19.6,0) returned #VALUE! — but only for prices that actually
  // had a decimal point, since "100" parses in any locale.
  it('writes a decimal Products USD as a number so the formula does not depend on locale', async () => {
    const sheet = await loadSheet(
      await build({ products: [product(DECIMAL_USD)] }),
      PRODUCTS_SHEET_NAME,
    );

    expect(typeof sheet.getCell('E2').value).toBe('number');
    expect(sheet.getCell('E2').value).toBe(18.5);
  });

  it('writes a decimal Variants USD as a number too', async () => {
    const sheet = await loadSheet(
      await build({ variants: [variant(DECIMAL_USD)] }),
      VARIANTS_SHEET_NAME,
    );
    const usd = sheet.getColumn(5).values.find((value) => value === 18.5);

    expect(typeof usd).toBe('number');
  });

  // A price nobody could parse as a number ("ask", "") must survive verbatim
  // rather than becoming 0 — the import reads '' as "leave unchanged".
  it('leaves a non-numeric USD as the original text', async () => {
    const sheet = await loadSheet(
      await build({ products: [product({ priceUsd: 'ask', priceTmt: '' })] }),
      PRODUCTS_SHEET_NAME,
    );

    expect(sheet.getCell('E2').value).toBe('ask');
  });

  it('keeps an empty USD empty instead of coercing it to 0', async () => {
    const sheet = await loadSheet(
      await build({ products: [product({ priceUsd: '', priceTmt: '' })] }),
      PRODUCTS_SHEET_NAME,
    );

    expect(cellText(sheet.getCell('E2').value)).toBe('');
  });

  it('round-trips a decimal USD unchanged through the numeric cell', async () => {
    const parsed = await parseWorkbook(
      await fileFrom(await build({ products: [product(DECIMAL_USD)] })),
    );

    expect(parsed.products[0].priceUsd).toBe('18.5');
    expect(parsed.products[0].priceTmt).toBe('');
  });
});

describe('bulk-edit TMT formula caches its result', () => {
  // Without a cached <v> there is nothing to fall back on: a viewer that does
  // not recalculate on open, or an Excel that errors on the operand, shows the
  // admin no manat price at all.
  it('caches the computed manat alongside the Products formula', async () => {
    const sheet = await loadSheet(
      await build({ products: [product(DECIMAL_USD)] }),
      PRODUCTS_SHEET_NAME,
    );
    const tmt = sheet.getCell('F2').value as ExcelJS.CellFormulaValue;

    expect(tmt.formula).toBe('ROUNDUP(E2*19.6,0)');
    expect(tmt.result).toBe(363);
  });

  it('caches the computed manat alongside the Variants formula', async () => {
    const sheet = await loadSheet(
      await build({ variants: [variant(DECIMAL_USD)] }),
      VARIANTS_SHEET_NAME,
    );
    const tmt = sheet
      .getColumn(6)
      .values.find(
        (value): value is ExcelJS.CellFormulaValue =>
          typeof value === 'object' && value != null && 'formula' in value,
      )!;

    expect(tmt.result).toBe(363);
  });
});
