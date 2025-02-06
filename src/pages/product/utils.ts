import BASE_URL from '@/lib/ApiEndpoints';
import { curlyBracketRegex, squareBracketRegex } from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
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
        .map((row) => row.match(regex) || [])
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

export const fetchDollarRate = async (): Promise<number> => {
  const { success, data, message } = await (
    await fetch(`${BASE_URL}/api/prices/rate`)
  ).json();
  if (!success || data == null) {
    throw new Error('Failed to fetch dollar rate: ', message);
  }
  return data.rate;
};

// returns product.price from session or fetches from db
export const computePrice = async (priceId: string): Promise<string> => {
  const cachePrice = sessionStorage.getItem(priceId);
  if (cachePrice != null) {
    return cachePrice;
  }

  const res: ResponseApi<Prices> = await (
    await fetch(`${BASE_URL}/api/prices?id=${priceId}`)
  ).json();

  if (res.success && res.data != null) {
    sessionStorage.setItem(priceId, res.data.priceInTmt);
    return res.data.priceInTmt;
  }
  return priceId;
};

// ProductPrice has product.price = [id]{value} format. So only {value} extracted and returned.
// If {value} doesn't exist, computePrice function is used for safety
export const computeProductPrice = async (product: Product) => {
  const priceMatchId = product.price?.match(squareBracketRegex);
  const priceMatchValue = product.price?.match(curlyBracketRegex);
  const processedProduct = { ...product };

  if (priceMatchValue != null && priceMatchId != null) {
    processedProduct.price = priceMatchValue[1];
    sessionStorage.setItem(priceMatchId[1], priceMatchValue[1]);
  } else if (priceMatchId != null) {
    processedProduct.price = await computePrice(priceMatchId[1]);
  }

  return processedProduct;
};

// ProductPriceTags have only [id], value is fetched in computePrice function.
export const computeProductPriceTags = async (
  product: Product,
): Promise<Product> => {
  const priceComputedTags = await computeProductPrice(product);
  const priceTagsComputedProduct = {
    ...priceComputedTags,
    tags: await Promise.all(
      priceComputedTags.tags.map(async (tag) => {
        const tagMatch = tag.match(squareBracketRegex);
        if (tagMatch != null) {
          const idTag = tagMatch[1];
          const price = await computePrice(idTag);

          return tag.replace(`[${idTag}]`, price);
        }
        return tag;
      }),
    ),
  };

  return priceTagsComputedProduct;
};

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

// both of them work
// this specifically returns either Promise or undefined. delete code below if void above is commonly used

// export const debounce = <T extends (...args: any[]) => any>(
//   func: T,
//   delay: number,
// ) => {
//   let timeoutId: NodeJS.Timeout;

//   return (...args: Parameters<T>):(ReturnType<T> extends Promise<any>
//     ? Promise<void>
//     : undefined) => {
//       if (timeoutId)
//         clearTimeout(timeoutId);

//       return new Promise(resolve => {
//        timeoutId = setTimeout(() => {
//           const result = func(...args);
//           if (result instanceof Promise)
//             result.then(resolve).catch((error) => {console.error('Debounce failed', error)});
//           else
//             resolve(result);
//         }, delay);
//       }) as ReturnType<T> extends Promise<any> ? Promise<void> : undefined;
//     }
// }
