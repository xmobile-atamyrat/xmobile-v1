import { curlyBracketRegex, squareBracketRegex } from '@/pages/lib/constants';
import { ExtendedCategory, FetchWithCredsType } from '@/pages/lib/types';
import { Color, Prices, Product } from '@prisma/client';
import Papa, { ParseResult } from 'papaparse';
import { ChangeEvent, Dispatch, SetStateAction } from 'react';
import * as XLSX from 'xlsx';

const regex = /(".*?"|[^",]+|(?<=,)(?=,)|(?<=,)$|^,)/g;
export type TableData = (string | number | boolean | null)[][];
export const PRICE_NAME_IDX = 0;
export const PRICE_DOLLAR_IDX = 1;
export const PRICE_MANAT_IDX = 2;
export const PRICE_CATEGORY_IDX = 3;
export const PRICE_ID_IDX = 4;

export const handleFileUpload = (
  event: ChangeEvent<HTMLInputElement>,
  setTableData: Dispatch<SetStateAction<TableData>>,
) => {
  const file = event.target.files?.[0];
  if (file == null) return;
  const reader = new FileReader();

  reader.onload = (e) => {
    if (e.target == null) return;
    const data = e.target.result;
    if (file.type === 'text/csv') {
      if (typeof data === 'string') {
        Papa.parse(data, {
          header: true,
          complete: (results: ParseResult<any>) => {
            setTableData(results.data);
          },
        });
      }
    } else {
      const arrayBuffer = data as ArrayBuffer;
      const binaryString = String.fromCharCode(...new Uint8Array(arrayBuffer));
      const workbook = XLSX.read(binaryString, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_csv(sheet);
      const tbData = jsonData
        .split('\n')
        .map((row) => (row.match(regex) || []) as RegExpMatchArray)
        .map((row) => row.filter((_, idx) => idx === 1 || idx === 2))
        .filter((row) => row[0] !== '' && !row[1].includes('-'))
        .map((row) => [row[0], row[1].split('"').join('').trim()])
        .map((row) => [row[0], parseInt(row[1].replaceAll(',', ''), 10)])
        .map((row) => [row[0], (row[1] as number) / 20]);

      setTableData(tbData);
    }
  };

  if (file.type === 'text/csv') {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
};

export const parsePrice = (price: string): number => {
  if (price == null) return 0;
  return parseFloat(parseFloat(price).toFixed(2));
};

// The single USD -> TMT rounding rule: prices are always whole manat, rounded
// up. The toFixed absorbs IEEE-754 error before the ceil — 50 * 19.6 is
// 980.0000000000001, which a bare Math.ceil would bill as 981.
export const tmtFromUsd = (usd: number, rate: number): number =>
  Math.ceil(parseFloat((usd * rate).toFixed(6)));

export interface ParsedVariantTag {
  specText: string; // tag text with [..] and {..} stripped, e.g. "128gb storage 12gb ram"
  priceId?: string; // referenced Prices id, from [..]
  colorId?: string; // referenced Color id, from {..}
}

// Parses a raw variant tag like "128gb storage 12gb ram [priceId]{colorId}".
// priceId/colorId are references; specText is the human-readable variant label.
export const parseVariantTag = (tag: string): ParsedVariantTag => {
  const priceId = tag.match(squareBracketRegex)?.[1];
  const colorId = tag.match(curlyBracketRegex)?.[1];

  const specText = tag
    .replace(squareBracketRegex, '')
    .replace(curlyBracketRegex, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { specText, priceId, colorId };
};

export interface VariantDisplay {
  spec: string;
  colorHex?: string;
  colorName?: string;
}

// Resolves a raw variant tag to a display (spec + color hex/name) using a colors map.
export const resolveVariantDisplay = (
  rawTag: string,
  colorsMap: Map<string, Color>,
): VariantDisplay => {
  const { specText, colorId } = parseVariantTag(rawTag);
  const color = colorId ? colorsMap.get(colorId) : undefined;
  return { spec: specText, colorHex: color?.hex, colorName: color?.name };
};

// Order items snapshot the variant as JSON ({spec, colorHex, colorName}).
// Older orders stored a plain string — fall back to showing it as the spec.
export const parseOrderVariant = (raw: string): VariantDisplay => {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && typeof obj.spec === 'string') {
      return {
        spec: obj.spec,
        colorHex: obj.colorHex ?? undefined,
        colorName: obj.colorName ?? undefined,
      };
    }
  } catch (_) {
    // legacy plain-text snapshot
  }
  return { spec: raw };
};

// The category cell holds the raw categoryId, not a display name: resolving the
// localized name needs the category tree, which lives in the page's context.
export const processPrices = (prices: Prices[]): TableData => {
  const processedPrices = prices.map(
    ({ id, name, price, priceInTmt, categoryId }) => [
      name,
      price,
      parsePrice(priceInTmt),
      categoryId,
      id,
    ],
  ) as TableData;

  return [['Name', 'Dollars', 'Manat', 'Category', 'ID'], ...processedPrices];
};

export const isPriceValid = (price: string): boolean => {
  return /^[0-9]*\.?[0-9]+$/.test(price);
};

// Overlays typed-but-unsaved edits onto derived table rows. Edits are keyed by
// price id (not row index) so re-sorting/filtering/searching can never merge one
// price's pending values onto another. The header row is passed through.
export const applyPendingEdits = (
  data: TableData,
  edits: Record<string, Partial<Prices>>,
): TableData =>
  data.map((row, index) => {
    if (index === 0) return row; // header
    const edit = edits[row[PRICE_ID_IDX] as string];
    if (edit == null) return row;
    const next = [...row];
    if (edit.name != null) next[PRICE_NAME_IDX] = edit.name;
    if (edit.price != null) next[PRICE_DOLLAR_IDX] = edit.price;
    if (edit.priceInTmt != null)
      next[PRICE_MANAT_IDX] = parsePrice(edit.priceInTmt);
    // Keyed on presence, not null-ness: clearing a category is a legitimate
    // edit whose value is null, which a `!= null` guard would silently drop.
    if ('categoryId' in edit)
      next[PRICE_CATEGORY_IDX] = edit.categoryId ?? null;
    return next;
  });

// Sort/filter helpers for the update-prices page. Pure functions over Prices[]
// so the page can sort/filter client-side without touching the edit/save flow.
export type PriceSortKey =
  | ''
  | 'nameAsc'
  | 'nameDesc'
  | 'dollarAsc'
  | 'dollarDesc'
  | 'manatAsc'
  | 'manatDesc'
  | 'editedRecent'
  | 'editedStale';

const editedTime = (p: Prices) => new Date(p.updatedAt).getTime();

// Returns a sorted copy; '' (or unknown key) keeps the original order.
export const sortPrices = (prices: Prices[], key: PriceSortKey): Prices[] => {
  const sorted = [...prices];
  switch (key) {
    case 'nameAsc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'nameDesc':
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case 'dollarAsc':
      return sorted.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    case 'dollarDesc':
      return sorted.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    case 'manatAsc':
      return sorted.sort(
        (a, b) => parsePrice(a.priceInTmt) - parsePrice(b.priceInTmt),
      );
    case 'manatDesc':
      return sorted.sort(
        (a, b) => parsePrice(b.priceInTmt) - parsePrice(a.priceInTmt),
      );
    case 'editedRecent':
      return sorted.sort((a, b) => editedTime(b) - editedTime(a));
    case 'editedStale':
      return sorted.sort((a, b) => editedTime(a) - editedTime(b));
    default:
      return sorted;
  }
};

// Keeps prices whose own category relation is in categoryIds. Matches on
// Prices.categoryId rather than the categories of the products referencing the
// price, so an admin's explicit assignment is what the filter honours.
// Empty categoryIds -> no filtering (all prices returned).
export const filterPricesByCategories = (
  prices: Prices[],
  categoryIds: Set<string>,
): Prices[] => {
  if (categoryIds.size === 0) return prices;
  return prices.filter(
    (p) => p.categoryId != null && categoryIds.has(p.categoryId),
  );
};

// Sentinel value for the "no product" option in the category filter dropdown.
export const NO_PRODUCT_FILTER = '__noProduct__';

// Sentinel value for the "no category" option in the category filter dropdown.
// Distinct from NO_PRODUCT_FILTER: the two describe the same prices only until
// an admin edits categories by hand (e.g. clearing the category on a price that
// several products still reference puts it in one list but not the other).
export const NO_CATEGORY_FILTER = '__noCategory__';

// Prices with no category relation of their own.
export const filterPricesWithoutCategory = (prices: Prices[]): Prices[] =>
  prices.filter((p) => p.categoryId == null);

// Prices referenced by no product (absent or empty in the category map).
// Backs the "no product" option in the update-prices category filter.
export const filterPricesWithoutProduct = (
  prices: Prices[],
  priceCategoryMap: Record<string, string[]>,
): Prices[] =>
  prices.filter((p) => (priceCategoryMap[p.id] ?? []).length === 0);

// Collects a category id plus all descendant ids from the nested category tree
// (as returned by /api/category). Used to make a category filter include the
// prices of products in its subcategories, not just the exact category.
export const collectCategorySubtreeIds = (
  categories: ExtendedCategory[],
  targetId: string,
): Set<string> => {
  const result = new Set<string>();
  const collect = (node: ExtendedCategory) => {
    result.add(node.id);
    node.successorCategories?.forEach(collect);
  };
  const find = (nodes: ExtendedCategory[]): ExtendedCategory | undefined => {
    let match: ExtendedCategory | undefined;
    nodes.some((node) => {
      if (node.id === targetId) {
        match = node;
      } else if (node.successorCategories) {
        match = find(node.successorCategories);
      }
      return match != null;
    });
    return match;
  };
  const target = find(categories);
  if (target) collect(target);
  return result;
};

// Fetches the price's TMT value from the db. Deliberately uncached: this used
// to memoize into sessionStorage with nothing to invalidate it, so any price
// edit (bulk upload, /product/update-prices, the product dialog) stayed
// invisible for the rest of the tab's session — including in the cart.
export const computePrice = async ({
  accessToken,
  fetchWithCreds,
  priceId,
}: {
  priceId: string;
  accessToken: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<string> => {
  const { success, data } = await fetchWithCreds<Prices>({
    accessToken,
    path: `/api/prices?id=${priceId}`,
    method: 'GET',
  });

  if (success && data) {
    return data.priceInTmt;
  }
  return priceId;
};

// ProductPrice has product.price = [id]{value} format. So only {value} extracted and returned.
// If {value} doesn't exist, computePrice function is used for safety
export const computeProductPrice = async ({
  accessToken,
  fetchWithCreds,
  product,
}: {
  product: Product;
  accessToken: string;
  fetchWithCreds: FetchWithCredsType;
}) => {
  const priceMatchId = product.price?.match(squareBracketRegex);
  const priceMatchValue = product.price?.match(curlyBracketRegex);
  const processedProduct = { ...product };

  if (priceMatchValue != null && priceMatchId != null) {
    processedProduct.price = priceMatchValue[1];
  } else if (priceMatchId != null) {
    processedProduct.price = await computePrice({
      priceId: priceMatchId[1],
      accessToken,
      fetchWithCreds,
    });
  }

  return processedProduct;
};

// ProductPriceTags have only [id], value is fetched in computePrice function.
export const computeProductPriceTags = async ({
  accessToken,
  fetchWithCreds,
  product,
}: {
  product: Product;
  accessToken: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<Product> => {
  const priceComputedTags = await computeProductPrice({
    product,
    accessToken,
    fetchWithCreds,
  });
  const priceTagsComputedProduct = {
    ...priceComputedTags,
    tags: await Promise.all(
      priceComputedTags.tags.map(async (tag) => {
        const tagMatch = tag.match(squareBracketRegex);
        if (tagMatch != null) {
          const idTag = tagMatch[1];
          const price = await computePrice({
            priceId: idTag,
            accessToken,
            fetchWithCreds,
          });

          return tag.replace(`[${idTag}]`, price);
        }
        return tag;
      }),
    ),
  };

  return priceTagsComputedProduct;
};

// Use this function inside useCallBack to retain timeoutId across renders.
// Without it, a new debounce is created each time, defining a new timeoutId to undefined
export const debounce = (func: (...args: any[]) => void, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};
