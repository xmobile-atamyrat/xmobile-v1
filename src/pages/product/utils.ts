import BASE_URL from '@/lib/ApiEndpoints';
import { squareBracketRegex } from '@/pages/lib/constants';
import { Prices, Product } from '@prisma/client';
import Papa, { ParseResult } from 'papaparse';
import { ChangeEvent, Dispatch, SetStateAction } from 'react';
import * as XLSX from 'xlsx';

const regex = /(".*?"|[^",]+|(?<=,)(?=,)|(?<=,)$|^,)/g;
export type TableData = (string | number | boolean | null)[][];

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

export const parsePrice = ({
  price,
  rate,
}: {
  price?: string;
  rate: number;
}): number => {
  if (price == null) return 0;
  return parseFloat((parseFloat(price) * rate).toFixed(2));
};

export const processPrices = (
  prices: Partial<Prices>[],
  rate: number,
): TableData => {
  const processedPrices = prices.map(({ name, price }) => [
    name,
    price,
    parsePrice({ price, rate }),
  ]) as TableData;

  return [['Towar', 'Dollarda Bahasy', 'Manatda Bahasy'], ...processedPrices];
};

export const isPriceValid = (price: string): boolean => {
  return /^[0-9]*\.?[0-9]+$/.test(price);
};

export const dollarToManat = (
  dollarRate: number,
  price?: string | null,
): string => {
  if (price == null) return '0';
  return parseFloat((parseFloat(price) * dollarRate).toFixed(2)).toString();
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

export const computeProductPrice = async (
  product: Product,
  rate?: number,
): Promise<Product> => {
  if (rate == null) {
    rate = await fetchDollarRate();
  }
  const priceMatch = product.price?.match(squareBracketRegex);
  if (priceMatch == null) return product;
  const res = await (
    await fetch(`${BASE_URL}/api/prices?productName=${priceMatch[1]}`)
  ).json();
  if (res.success && res.data != null) {
    const processedProduct = { ...product };
    processedProduct.price = dollarToManat(rate, res.data.price);
    return processedProduct;
  }
  return product;
};

export const computeProductPriceTags = async (
  product: Product,
): Promise<Product> => {
  const rate = await fetchDollarRate();
  const priceComputedTags = await computeProductPrice(product, rate);
  const priceTagsComputedProduct = {
    ...priceComputedTags,
    tags: await Promise.all(
      priceComputedTags.tags.map(async (tag) => {
        const tagMatch = tag.match(squareBracketRegex);
        if (tagMatch != null) {
          const nameTag = tagMatch[1];
          const res = await (
            await fetch(`${BASE_URL}/api/prices?productName=${nameTag}`)
          ).json();
          if (res.success && res.data != null) {
            return tag.replace(
              `[${nameTag}]`,
              dollarToManat(rate, res.data.price),
            );
          }
        }
        return tag;
      }),
    ),
  };

  return priceTagsComputedProduct;
};
