import { curlyBracketRegex, squareBracketRegex } from '@/pages/lib/constants';
import { FetchWithCredsType } from '@/pages/lib/types';
import { Prices, Product } from '@prisma/client';
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

export const computeVariantPrice = async ({
  tag,
  accessToken,
  fetchWithCreds,
}: {
  tag: string;
  accessToken: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<number | null> => {
  const tagMatch = tag.match(squareBracketRegex);
  if (tagMatch) {
    const priceId = tagMatch[1];
    const priceStr = await computePrice({
      priceId,
      accessToken,
      fetchWithCreds,
    });
    const price = parseFloat(priceStr);
    return Number.isNaN(price) ? null : price;
  }
  return null;
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
