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

  it('locks the identity columns on the Variants sheet and leaves price cells open', async () => {
    const blob = await build({ variants: [variant()] });
    const sheet = await loadSheet(blob, VARIANTS_SHEET_NAME);
    const row = sheet.getRow(3); // banner, header, first data row

    expect(row.getCell(1).protection?.locked).not.toBe(false); // Price ID
    expect(row.getCell(2).protection?.locked).not.toBe(false); // Product ID
    expect(row.getCell(3).protection?.locked).not.toBe(false); // Product Name
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
