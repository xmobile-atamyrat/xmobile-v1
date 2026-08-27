import { describe, expect, it } from 'vitest';

import type { ExtendedCategory } from '@/pages/lib/types';
import {
  buildPriceListBlob,
  buildPriceSections,
  cascadeCategorySelection,
  defaultPriceListFileName,
  priceListFileName,
  PRICE_LIST_SHEET_NAME,
  toggleAllCategories,
} from '@/pages/product/price-list/lib';
import type { Prices } from '@prisma/client';

const price = (over: Partial<Prices> = {}): Prices =>
  ({
    id: 'pr1',
    name: '128gb 8gb ram',
    price: '100',
    priceInTmt: '1960',
    categoryId: 'phones',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as Prices;

const category = (
  id: string,
  successorCategories: ExtendedCategory[] = [],
): ExtendedCategory =>
  ({
    id,
    slug: id,
    name: `tk:${id}`,
    successorCategories,
  }) as unknown as ExtendedCategory;

// phones > iphone, plus a sibling tablets
const tree: ExtendedCategory[] = [
  category('phones', [category('iphone')]),
  category('tablets'),
];

// phones > (iphone > iphone15, samsung), plus a sibling tablets
const deepTree: ExtendedCategory[] = [
  category('phones', [
    category('iphone', [category('iphone15')]),
    category('samsung'),
  ]),
  category('tablets'),
];

const readSheet = async (blob: Blob) => {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  return workbook.getWorksheet(PRICE_LIST_SHEET_NAME)!;
};

describe('buildPriceSections', () => {
  it('puts a subcategory price in the selected parent section', () => {
    const sections = buildPriceSections(
      [price({ id: 'a', categoryId: 'iphone' })],
      tree,
      ['phones'],
      'tk',
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].categoryId).toBe('phones');
    expect(sections[0].prices.map((p) => p.id)).toEqual(['a']);
  });

  it('lists a price once, under the deepest selected category', () => {
    const sections = buildPriceSections(
      [price({ id: 'a', categoryId: 'iphone' })],
      tree,
      ['phones', 'iphone'],
      'tk',
    );

    expect(sections.map((s) => s.categoryId)).toEqual(['iphone']);
    expect(sections[0].prices.map((p) => p.id)).toEqual(['a']);
  });

  it('sorts prices by name within a section', () => {
    const sections = buildPriceSections(
      [
        price({ id: 'b', name: '256gb 12gb ram' }),
        price({ id: 'a', name: '128gb 8gb ram' }),
      ],
      tree,
      ['phones'],
      'tk',
    );

    expect(sections[0].prices.map((p) => p.name)).toEqual([
      '128gb 8gb ram',
      '256gb 12gb ram',
    ]);
  });

  it('orders sections by the category tree, not by selection order', () => {
    const sections = buildPriceSections(
      [
        price({ id: 'a', categoryId: 'tablets' }),
        price({ id: 'b', categoryId: 'phones' }),
      ],
      tree,
      ['tablets', 'phones'],
      'tk',
    );

    expect(sections.map((s) => s.categoryId)).toEqual(['phones', 'tablets']);
  });

  it('drops a selected category that has no prices', () => {
    const sections = buildPriceSections(
      [price({ categoryId: 'phones' })],
      tree,
      ['phones', 'tablets'],
      'tk',
    );

    expect(sections.map((s) => s.categoryId)).toEqual(['phones']);
  });

  it('excludes prices with no category of their own', () => {
    const sections = buildPriceSections(
      [price({ id: 'a', categoryId: null })],
      tree,
      ['phones'],
      'tk',
    );

    expect(sections).toEqual([]);
  });

  it('carries the ancestor path so same-named subcategories can be told apart', () => {
    const sections = buildPriceSections(
      [price({ categoryId: 'iphone' })],
      tree,
      ['iphone'],
      'tk',
    );

    expect(sections[0].categoryPath).toEqual(['tk:phones', 'tk:iphone']);
  });

  it('localizes the section name from the category name', () => {
    const sections = buildPriceSections(
      [price({ categoryId: 'phones' })],
      [
        {
          ...category('phones'),
          name: '{"tk":"Telefonlar","en":"Phones"}',
        } as ExtendedCategory,
      ],
      ['phones'],
      'en',
    );

    expect(sections[0].categoryName).toBe('Phones');
  });
});

describe('cascadeCategorySelection', () => {
  it('selects the whole subtree when a parent is picked', () => {
    expect(cascadeCategorySelection(deepTree, [], ['phones'])).toEqual([
      'phones',
      'iphone',
      'iphone15',
      'samsung',
    ]);
  });

  it('keeps the parent selected when one child is unpicked', () => {
    const all = ['phones', 'iphone', 'iphone15', 'samsung'];

    expect(
      cascadeCategorySelection(
        deepTree,
        all,
        all.filter((id) => id !== 'iphone'),
      ),
    ).toEqual(['phones', 'samsung']);
  });

  it('clears the subtree when the parent is unpicked', () => {
    const all = ['phones', 'iphone', 'iphone15', 'samsung', 'tablets'];

    expect(
      cascadeCategorySelection(
        deepTree,
        all,
        all.filter((id) => id !== 'phones'),
      ),
    ).toEqual(['tablets']);
  });

  it('picks a child without picking its parent', () => {
    expect(cascadeCategorySelection(deepTree, [], ['iphone'])).toEqual([
      'iphone',
      'iphone15',
    ]);
  });

  it('orders the selection by the category tree', () => {
    expect(
      cascadeCategorySelection(deepTree, ['tablets'], ['tablets', 'samsung']),
    ).toEqual(['samsung', 'tablets']);
  });
});

describe('toggleAllCategories', () => {
  const everyId = ['phones', 'iphone', 'iphone15', 'samsung', 'tablets'];

  it('selects every category when none are selected', () => {
    expect(toggleAllCategories(deepTree, [])).toEqual(everyId);
  });

  it('selects the rest when only some are selected', () => {
    expect(toggleAllCategories(deepTree, ['tablets'])).toEqual(everyId);
  });

  it('clears the selection when every category is already selected', () => {
    expect(toggleAllCategories(deepTree, everyId)).toEqual([]);
  });
});

describe('defaultPriceListFileName', () => {
  const date = new Date(2026, 7, 15);

  it('names the file after the picked parent, not its cascaded children', () => {
    expect(
      defaultPriceListFileName(
        deepTree,
        ['phones', 'iphone', 'iphone15', 'samsung'],
        'tk',
        date,
      ),
    ).toBe('tk:phones 15-08-2026');
  });

  it('joins every independently picked category', () => {
    expect(
      defaultPriceListFileName(deepTree, ['phones', 'tablets'], 'tk', date),
    ).toBe('tk:phones, tk:tablets 15-08-2026');
  });

  it('names a child picked without its parent', () => {
    expect(
      defaultPriceListFileName(deepTree, ['iphone', 'iphone15'], 'tk', date),
    ).toBe('tk:iphone 15-08-2026');
  });

  it('falls back to a generic name when nothing is picked', () => {
    expect(defaultPriceListFileName(deepTree, [], 'tk', date)).toBe(
      'prices 15-08-2026',
    );
  });
});

describe('priceListFileName', () => {
  it('appends the workbook extension', () => {
    expect(priceListFileName('tk:phones 15-08-2026')).toBe(
      'tk-phones 15-08-2026.xlsx',
    );
  });

  it('keeps an extension the user typed', () => {
    expect(priceListFileName('price list.xlsx')).toBe('price list.xlsx');
  });

  it('replaces characters a file name cannot hold', () => {
    expect(priceListFileName('phones/tablets')).toBe('phones-tablets.xlsx');
  });

  it('falls back when the name is blanked out', () => {
    expect(priceListFileName('   ')).toBe('prices.xlsx');
  });
});

describe('buildPriceListBlob', () => {
  const sections = () =>
    buildPriceSections([price({ id: 'a' })], tree, ['phones'], 'tk');

  it('writes the dollar rate into B1 so every TMT cell can reference it', async () => {
    const sheet = await readSheet(await buildPriceListBlob(sections(), 19.6));

    expect(sheet.getCell('B1').value).toBe(19.6);
  });

  it('computes TMT with a ROUNDUP formula anchored to the rate cell', async () => {
    const sheet = await readSheet(await buildPriceListBlob(sections(), 19.6));

    // row 1 rate, row 2 blank, row 3 category banner, row 4 header, row 5 price
    expect(sheet.getCell('C5').value).toEqual({
      formula: 'ROUNDUP(B5*$B$1,0)',
      result: 1960,
    });
  });

  it('lays out a category banner above a Name/USD/TMT header', async () => {
    const sheet = await readSheet(await buildPriceListBlob(sections(), 19.6));

    expect(sheet.getCell('A3').value).toBe('tk:phones');
    expect(sheet.getCell('A4').value).toBe('Name');
    expect(sheet.getCell('B4').value).toBe('USD');
    expect(sheet.getCell('C4').value).toBe('TMT');
    expect(sheet.getCell('A5').value).toBe('128gb 8gb ram');
    expect(sheet.getCell('B5').value).toBe(100);
  });

  it('separates consecutive category sections with a blank row', async () => {
    const multi = buildPriceSections(
      [
        price({ id: 'a', categoryId: 'phones' }),
        price({ id: 'b', categoryId: 'tablets', name: 'wifi 64gb' }),
      ],
      tree,
      ['phones', 'tablets'],
      'tk',
    );
    const sheet = await readSheet(await buildPriceListBlob(multi, 19.6));

    expect(sheet.getCell('A6').value).toBe(null); // blank separator
    expect(sheet.getCell('A7').value).toBe('tk:tablets');
    expect(sheet.getCell('C9').value).toEqual({
      formula: 'ROUNDUP(B9*$B$1,0)',
      result: 1960,
    });
  });

  it('banners a subcategory with its parent, not by its own name alone', async () => {
    const nested = buildPriceSections(
      [price({ categoryId: 'iphone' })],
      tree,
      ['iphone'],
      'tk',
    );
    const sheet = await readSheet(await buildPriceListBlob(nested, 19.6));

    expect(sheet.getCell('A3').value).toBe('tk:phones > tk:iphone');
  });

  it('fills the whole banner row so it reads as a section break', async () => {
    const sheet = await readSheet(await buildPriceListBlob(sections(), 19.6));

    ['A3', 'B3', 'C3'].forEach((address) => {
      expect(sheet.getCell(address).fill).toMatchObject({ pattern: 'solid' });
    });
    expect(sheet.getCell('A5').fill).toBeUndefined(); // price rows stay plain
  });

  it('tints a nested section differently from a top-level one', async () => {
    const nested = buildPriceSections(
      [price({ categoryId: 'iphone' })],
      tree,
      ['iphone'],
      'tk',
    );
    const topLevel = await readSheet(
      await buildPriceListBlob(sections(), 19.6),
    );
    const child = await readSheet(await buildPriceListBlob(nested, 19.6));

    expect(child.getCell('A3').fill).not.toEqual(topLevel.getCell('A3').fill);
  });

  it('falls back to the stored TMT literal when no rate is known', async () => {
    const sheet = await readSheet(await buildPriceListBlob(sections(), null));

    expect(sheet.getCell('B1').value).toBe(null);
    expect(sheet.getCell('C5').value).toBe(1960);
  });
});
