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
export const PRICE_ID_IDX = 3;

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

export const processPrices = (prices: Prices[]): TableData => {
  const processedPrices = prices.map(({ id, name, price, priceInTmt }) => [
    name,
    price,
    parsePrice(priceInTmt),
    id,
  ]) as TableData;

  return [['Name', 'Dollars', 'Manat', 'ID'], ...processedPrices];
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

// Keeps prices referenced by a product whose categoryId is in categoryIds.
// Empty categoryIds -> no filtering (all prices returned).
export const filterPricesByCategories = (
  prices: Prices[],
  priceCategoryMap: Record<string, string[]>,
  categoryIds: Set<string>,
): Prices[] => {
  if (categoryIds.size === 0) return prices;
  return prices.filter((p) =>
    (priceCategoryMap[p.id] ?? []).some((c) => categoryIds.has(c)),
  );
};

// Sentinel value for the "no product" option in the category filter dropdown.
export const NO_PRODUCT_FILTER = '__noProduct__';

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

// returns product.price from session or fetches from db
export const computePrice = async ({
  accessToken,
  fetchWithCreds,
  priceId,
}: {
  priceId: string;
  accessToken: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<string> => {
  const cachePrice = sessionStorage.getItem(priceId);
  if (cachePrice != null) {
    return cachePrice;
  }

  const { success, data } = await fetchWithCreds<Prices>({
    accessToken,
    path: `/api/prices?id=${priceId}`,
    method: 'GET',
  });

  if (success && data) {
    sessionStorage.setItem(priceId, data.priceInTmt);
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
    sessionStorage.setItem(priceMatchId[1], priceMatchValue[1]);
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
