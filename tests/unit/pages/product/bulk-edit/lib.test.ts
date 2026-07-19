import { describe, expect, it } from 'vitest';

import {
  buildWorkbookBlob,
  parseWorkbook,
  PRODUCTS_SHEET_NAME,
} from '@/pages/product/bulk-edit/lib';

const product = (
  over: Partial<Parameters<typeof buildWorkbookBlob>[0][0]> = {},
) => ({
  id: 'p1',
  slug: 'p1',
  nameEn: 'iPhone',
  nameTk: '',
  nameRu: '',
  nameCh: '',
  nameTr: '',
  categorySlug: 'phones',
  brand: 'Apple',
  priceUsd: '100',
  priceTmt: '1960',
  isOutOfStock: false,
  videoUrls: '',
  ...over,
});

describe('bulk-edit workbook TMT formula round-trip', () => {
  it('exports an untouched TMT cell as a formula and reads it back as empty (auto-derive on import)', async () => {
    const blob = await buildWorkbookBlob([product()], [], 19.6);
    const file = new File([await blob.arrayBuffer()], 'x.xlsx');
    const parsed = await parseWorkbook(file);

    expect(parsed.products).toHaveLength(1);
    expect(parsed.products[0].priceUsd).toBe('100');
    expect(parsed.products[0].priceTmt).toBe('');
  });

  it('preserves an admin override typed over the formula', async () => {
    const blob = await buildWorkbookBlob([product()], [], 19.6);
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const sheet = workbook.getWorksheet(PRODUCTS_SHEET_NAME)!;
    sheet.getCell('K2').value = 2400; // admin overwrites the formula with a literal

    const buffer = await workbook.xlsx.writeBuffer();
    const file = new File([buffer], 'x.xlsx');
    const parsed = await parseWorkbook(file);

    expect(parsed.products[0].priceTmt).toBe('2400');
  });

  it('falls back to the plain last-known TMT value when no rate is available', async () => {
    const blob = await buildWorkbookBlob([product()], [], null);
    const file = new File([await blob.arrayBuffer()], 'x.xlsx');
    const parsed = await parseWorkbook(file);

    expect(parsed.products[0].priceTmt).toBe('1960');
  });
});
