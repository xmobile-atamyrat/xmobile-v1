import { HistoryPrice } from '@/pages/procurement/lib/types';
import { OrderPriceColor } from '@prisma/client';
import * as ExcelJS from 'exceljs';

export interface ExcelFileData {
  data: (string | number)[][];
  filename: string;
  sheetName?: string;
  supplierId: string;
  productIds: string[];
}

export const IDS_SHEET_NAME = 'IDs';
export const ORDER_SHEET_NAME = 'Order';

export const priceHash = ({
  orderId,
  productId,
  supplierId,
}: {
  orderId: string;
  productId: string;
  supplierId: string;
}): string => {
  return JSON.stringify({
    orderId,
    productId,
    supplierId,
  });
};

async function arrayToXlsxBlob(
  data: any[][],
  supplierId: string,
  productIds: string[],
): Promise<Blob | null> {
  if (!Array.isArray(data)) {
    console.error('Input data for Excel generation must be an array.');
    return null;
  }

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WebClient';
    workbook.lastModifiedBy = 'WebClient';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.model.keywords = supplierId;

    const worksheet = workbook.addWorksheet(ORDER_SHEET_NAME);
    worksheet.addRows(data);

    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? String(cell.value).length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength < 10 ? 10 : maxLength + 1;
    });
    if (data.length > 0 && data[0].length > 0) {
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
    }

    const idsWorksheet = workbook.addWorksheet(IDS_SHEET_NAME);
    idsWorksheet.state = 'veryHidden';
    idsWorksheet.addRow(['supplierId', 'productId']);
    productIds.forEach((productId, idx) => {
      if (idx === 0) {
        idsWorksheet.addRow([supplierId, productId]);
      } else {
        idsWorksheet.addRow(['', productId]);
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  } catch (error) {
    console.error(
      `Error generating Excel Blob for sheet "${ORDER_SHEET_NAME}":`,
      error,
    );
    return null;
  }
}

export const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * The same workbook `downloadXlsxFiles` writes (Order sheet + hidden IDs
 * sheet + supplier id in keywords), as a Blob, so callers can share it
 * instead of downloading it. Null when ExcelJS fails.
 */
export function xlsxBlobFromFileData(
  file: ExcelFileData,
): Promise<Blob | null> {
  return arrayToXlsxBlob(file.data, file.supplierId, file.productIds);
}

export async function downloadXlsxFiles(files: ExcelFileData[]): Promise<void> {
  if (!Array.isArray(files) || files.length === 0) {
    console.error('No files data provided to zip.');
    return;
  }

  await files.reduce((promiseChain, fileInfo) => {
    return promiseChain.then(async () => {
      if (
        !fileInfo ||
        typeof fileInfo !== 'object' ||
        !fileInfo.filename ||
        !Array.isArray(fileInfo.data)
      ) {
        console.error('Skipping invalid file data structure:', fileInfo);
        return;
      }

      let xlsxFilename = fileInfo.filename;
      if (!xlsxFilename.toLowerCase().endsWith('.xlsx')) {
        xlsxFilename += '.xlsx';
      }

      const xlsxBlob = await arrayToXlsxBlob(
        fileInfo.data,
        fileInfo.supplierId,
        fileInfo.productIds,
      );

      if (xlsxBlob) {
        const link = document.createElement('a');
        const url = URL.createObjectURL(xlsxBlob);
        link.href = url;
        link.download = xlsxFilename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Small delay for Safari to complete the download
        await new Promise((res) => {
          setTimeout(res, 300); // No return value from the executor
        });
      } else {
        console.error(
          `Failed to generate Excel file for ${fileInfo.filename}.`,
        );
      }
    });
  }, Promise.resolve());
}

export const dayMonthYearFromDate = (date: Date) => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const formattedDay = String(day).padStart(2, '0');
  const formattedMonth = String(month).padStart(2, '0');
  return `${formattedDay}-${formattedMonth}-${year}`;
};

export const assignColorToPrices = ({
  orderId,
  prices,
  productIds,
  supplierIds,
}: {
  productIds: string[];
  supplierIds: string[];
  orderId: string;
  prices: HistoryPrice;
}): HistoryPrice => {
  // partition prices into a 2D table
  const partitionedPrices: HistoryPrice[][] = [];
  productIds.forEach((productId) => {
    const row: HistoryPrice[] = [];
    supplierIds.forEach((supplierId) => {
      const key = priceHash({
        orderId,
        productId,
        supplierId,
      });
      if (prices[key]?.value != null) {
        row.push({ [key]: prices[key] });
      }
    });
    partitionedPrices.push(row);
  });

  // find the cheapest and expensive prices for all products across all suppliers
  const coloredPartitionedPrices = partitionedPrices.map((row) => {
    const definedPrices = row;
    const minPrice = Math.min(
      ...definedPrices.map((price) => Object.values(price)[0].value),
    );
    const maxPrice = Math.max(
      ...definedPrices.map((price) => Object.values(price)[0].value),
    );
    let minFound = false;
    let maxFound = false;
    return row.map((price) => {
      const [hash, priceColorPair] = Object.entries(price)[0];
      if (!minFound && priceColorPair.value === minPrice) {
        minFound = true;
        return {
          [hash]: {
            value: priceColorPair.value,
            color: OrderPriceColor.green,
          },
        };
      }
      if (!maxFound && priceColorPair.value === maxPrice) {
        maxFound = true;
        return {
          [hash]: {
            value: priceColorPair.value,
            color: OrderPriceColor.orange,
          },
        };
      }
      return {
        [hash]: {
          value: priceColorPair.value,
          color: OrderPriceColor.white,
        },
      };
    });
  });

  // create a new hash map from colored prices
  const updatedPrices: HistoryPrice = {};
  coloredPartitionedPrices.forEach((row) => {
    row.forEach((price) => {
      const [hash, priceColorPair] = Object.entries(price)[0];
      updatedPrices[hash] = {
        ...priceColorPair,
        color: priceColorPair.color as OrderPriceColor,
      };
    });
  });
  return updatedPrices;
};
