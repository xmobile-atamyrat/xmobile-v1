import type { ExtendedCategory } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { dayMonthYearFromDate } from '@/pages/procurement/lib/utils';
import { collectCategorySubtreeIds, tmtFromUsd } from '@/pages/product/utils';
import {
  bannerFont,
  fillRow,
  HEADER_FILL,
  NESTED_BANNER_FILL,
  PATH_SEPARATOR,
  ROOT_BANNER_FILL,
} from '@/pages/product/xlsxBanner';
import type { Prices } from '@prisma/client';
import * as ExcelJS from 'exceljs';

export const PRICE_LIST_SHEET_NAME = 'Prices';

const RATE_LABEL = 'USD rate';
const RATE_CELL = '$B$1';
const PRICE_HEADER = ['Name', 'USD', 'TMT'];
const LAST_COLUMN = 3;

/**
 * One banner-and-table block in the sheet. Both download modes produce these:
 * a category section carries its ancestor path, a brand section a single name.
 */
export interface PriceListSection {
  sectionId: string;
  sectionName: string;
  /** Ancestors first, the section itself last — `['Earphones', 'Apple']`. */
  sectionPath: string[];
  prices: Prices[];
}

// Depth-first walk of the tree, so sections come out in the order the
// categories appear in the app rather than the order they were clicked.
const orderedTreeIds = (categories: ExtendedCategory[]): string[] => {
  const ids: string[] = [];
  const walk = (nodes: ExtendedCategory[]) => {
    nodes.forEach((node) => {
      ids.push(node.id);
      if (node.successorCategories) walk(node.successorCategories);
    });
  };
  walk(categories);
  return ids;
};

/**
 * Turns the dropdown's raw next selection into a cascaded one: ticking a
 * category ticks its whole subtree, unticking one unticks its subtree.
 *
 * Only the categories the click actually changed are cascaded, so a child
 * unticked afterwards stays unticked — the parent and its other children keep
 * their own state instead of being re-selected on every render.
 */
export const cascadeCategorySelection = (
  categories: ExtendedCategory[],
  previous: string[],
  next: string[],
): string[] => {
  const before = new Set(previous);
  const after = new Set(next);
  const result = new Set(next);

  next
    .filter((id) => !before.has(id))
    .forEach((id) => {
      collectCategorySubtreeIds(categories, id).forEach((descendantId) =>
        result.add(descendantId),
      );
    });
  previous
    .filter((id) => !after.has(id))
    .forEach((id) => {
      collectCategorySubtreeIds(categories, id).forEach((descendantId) =>
        result.delete(descendantId),
      );
    });

  return orderedTreeIds(categories).filter((id) => result.has(id));
};

/** Sentinel value for the dropdown's select-all row — never a category id. */
export const ALL_CATEGORIES_OPTION = '__all__';

/**
 * Flips the select-all row: everything, unless everything is already picked,
 * in which case it clears — one row that both fills and empties the dropdown.
 */
export const toggleAllCategories = (
  categories: ExtendedCategory[],
  previous: string[],
): string[] => {
  const all = orderedTreeIds(categories);
  const selected = new Set(previous);
  return all.every((id) => selected.has(id)) ? [] : all;
};

/** A brand as the dropdown, the sheet banner and the file name show it. */
export interface BrandOption {
  id: string;
  name: string;
}

/** Sentinel value for the brand dropdown's select-all row — never a brand id. */
export const ALL_BRANDS_OPTION = '__all_brands__';

/** The brand dropdown's select-all row: fills, or clears once already full. */
export const toggleAllBrands = (
  brands: BrandOption[],
  previous: string[],
): string[] => {
  const all = brands.map((brand) => brand.id);
  const selected = new Set(previous);
  return all.every((id) => selected.has(id)) ? [] : all;
};

/**
 * Groups prices into one section per selected brand.
 *
 * Brands do not nest, so unlike categories there is no deepest owner to break a
 * tie: a price two selected brands both sell is listed under each of them.
 * Prices no branded product references are never exported, and a reference to a
 * price that has since been deleted is skipped.
 */
export const buildBrandPriceSections = (
  prices: Prices[],
  brands: BrandOption[],
  selectedIds: string[],
  brandPriceIds: Record<string, string[]>,
): PriceListSection[] => {
  const selected = new Set(selectedIds);
  const priceById = new Map(prices.map((price) => [price.id, price]));

  return brands
    .filter((brand) => selected.has(brand.id))
    .map((brand) => ({
      sectionId: brand.id,
      sectionName: brand.name,
      sectionPath: [brand.name],
      prices: (brandPriceIds[brand.id] ?? [])
        .map((id) => priceById.get(id))
        .filter((price): price is Prices => price != null)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((section) => section.prices.length > 0);
};

// The categories a person actually picked: a selected category whose ancestor
// is also selected only got there through the cascade above, so naming the
// file after it would repeat what the parent already says.
const selectionRootNames = (
  categories: ExtendedCategory[],
  selectedIds: string[],
  locale: string,
): string[] => {
  const selected = new Set(selectedIds);
  const names: string[] = [];
  const walk = (nodes: ExtendedCategory[], underSelected: boolean) => {
    nodes.forEach((node) => {
      const isSelected = selected.has(node.id);
      if (isSelected && !underSelected)
        names.push(parseName(node.name, locale));
      if (node.successorCategories) {
        walk(node.successorCategories, underSelected || isSelected);
      }
    });
  };
  walk(categories, false);
  return names;
};

const stampedFileName = (names: string[], date: Date): string => {
  const stamp = dayMonthYearFromDate(date);
  return names.length === 0
    ? `prices ${stamp}`
    : `${names.join(', ')} ${stamp}`;
};

/**
 * The name the download box starts with: the picked categories, then the date.
 * Editable on the page, so this is only a starting point.
 */
export const defaultPriceListFileName = (
  categories: ExtendedCategory[],
  selectedIds: string[],
  locale: string,
  date: Date,
): string =>
  stampedFileName(selectionRootNames(categories, selectedIds, locale), date);

/** The same starting point for brand mode: the picked brands, then the date. */
export const defaultBrandPriceListFileName = (
  brands: BrandOption[],
  selectedIds: string[],
  date: Date,
): string => {
  const selected = new Set(selectedIds);
  return stampedFileName(
    brands.filter((brand) => selected.has(brand.id)).map((brand) => brand.name),
    date,
  );
};

// Category names carry `/` and `:` (locale-tagged names, model numbers), which
// browsers either strip or read as a path when they hit the download attribute.
const ILLEGAL_FILE_NAME_CHARS = /[\\/:*?"<>|]/g;

/** Makes an edited name safe to hand to a download, extension included. */
export const priceListFileName = (name: string): string => {
  const base = name.replace(ILLEGAL_FILE_NAME_CHARS, '-').trim() || 'prices';
  return base.toLowerCase().endsWith('.xlsx') ? base : `${base}.xlsx`;
};

/**
 * Groups prices into one section per selected category.
 *
 * A price belongs to a selected category when its own `categoryId` is in that
 * category's subtree, so picking a parent also exports its subcategories'
 * prices. Selecting both a parent and its child lists each price once, under
 * the deepest selected category that claims it — otherwise the same row would
 * be printed twice in one sheet.
 *
 * Prices with no category of their own are never exported: the page offers no
 * way to select them.
 */
export const buildPriceSections = (
  prices: Prices[],
  categories: ExtendedCategory[],
  selectedIds: string[],
  locale: string,
): PriceListSection[] => {
  const selected = new Set(selectedIds);
  const ordered = orderedTreeIds(categories).filter((id) => selected.has(id));
  if (ordered.length === 0) return [];

  const subtrees = new Map<string, Set<string>>();
  ordered.forEach((id) => {
    subtrees.set(id, collectCategorySubtreeIds(categories, id));
  });

  // A deeper category's subtree is contained in its ancestor's, so the smallest
  // matching subtree is the deepest selected category claiming the price.
  const ownerOf = (categoryId: string): string | undefined => {
    let owner: string | undefined;
    let ownerSize = Infinity;
    ordered.forEach((id) => {
      const subtree = subtrees.get(id)!;
      if (subtree.has(categoryId) && subtree.size < ownerSize) {
        owner = id;
        ownerSize = subtree.size;
      }
    });
    return owner;
  };

  const grouped = new Map<string, Prices[]>();
  prices.forEach((price) => {
    if (price.categoryId == null) return;
    const owner = ownerOf(price.categoryId);
    if (owner == null) return;
    if (!grouped.has(owner)) grouped.set(owner, []);
    grouped.get(owner)!.push(price);
  });

  // Names are only unique among siblings — several parents own an "Apple" — so
  // each section keeps the path that leads to it, not just its own name.
  const pathById = new Map<string, string[]>();
  const collectPaths = (nodes: ExtendedCategory[], ancestors: string[]) => {
    nodes.forEach((node) => {
      const path = [...ancestors, parseName(node.name, locale)];
      pathById.set(node.id, path);
      if (node.successorCategories)
        collectPaths(node.successorCategories, path);
    });
  };
  collectPaths(categories, []);

  return ordered
    .filter((id) => (grouped.get(id) ?? []).length > 0)
    .map((id) => {
      const path = pathById.get(id) ?? [];
      return {
        sectionId: id,
        sectionName: path[path.length - 1] ?? '',
        sectionPath: path,
        prices: [...grouped.get(id)!].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      };
    });
};

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

// TMT as a live formula against the rate cell, so retyping the rate in B1
// recalculates every manat price in the sheet at once. `result` caches the
// value the app itself would compute (tmtFromUsd), so viewers that don't
// recalculate on open still show the right number. Without a rate there is
// nothing to compute against, and the stored manat price is written as-is.
function tmtCell(
  row: number,
  usd: number,
  storedTmt: string,
  rate: number | null,
): ExcelJS.CellValue {
  if (rate == null || Number.isNaN(usd)) {
    const stored = Number(storedTmt);
    return Number.isNaN(stored) ? storedTmt : stored;
  }
  return {
    formula: `ROUNDUP(B${row}*${RATE_CELL},0)`,
    result: tmtFromUsd(usd, rate),
  };
}

/**
 * One sheet: the dollar rate in B1, then a bold category banner + Name/USD/TMT
 * header per section, blank-row separated.
 */
export async function buildPriceListBlob(
  sections: PriceListSection[],
  rate: number | null,
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WebClient';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(PRICE_LIST_SHEET_NAME);
  sheet.getCell('A1').value = RATE_LABEL;
  sheet.getCell('A1').font = { bold: true };
  if (rate != null) sheet.getCell('B1').value = rate;

  let row = 3; // row 2 stays blank, separating the rate from the first section
  sections.forEach((section, index) => {
    if (index > 0) row += 1; // blank row between sections
    const isRoot = section.sectionPath.length <= 1;
    // The whole row is tinted, not just the merged text, so the colour survives
    // in viewers that drop the merge and reads as a band across the sheet.
    fillRow(
      sheet,
      row,
      LAST_COLUMN,
      isRoot ? ROOT_BANNER_FILL : NESTED_BANNER_FILL,
    );
    sheet.getCell(`A${row}`).value = section.sectionPath.join(PATH_SEPARATOR);
    sheet.getCell(`A${row}`).font = bannerFont(isRoot);
    sheet.mergeCells(`A${row}:C${row}`);
    row += 1;

    fillRow(sheet, row, LAST_COLUMN, HEADER_FILL);
    PRICE_HEADER.forEach((header, column) => {
      const cell = sheet.getCell(row, column + 1);
      cell.value = header;
      cell.font = { bold: true };
    });
    row += 1;

    section.prices.forEach((price) => {
      const usd = Number(price.price);
      sheet.getCell(`A${row}`).value = price.name;
      sheet.getCell(`B${row}`).value = Number.isNaN(usd) ? price.price : usd;
      sheet.getCell(`C${row}`).value = tmtCell(
        row,
        usd,
        price.priceInTmt,
        rate,
      );
      row += 1;
    });
  });

  styleSheet(sheet);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
