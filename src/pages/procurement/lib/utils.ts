import { HistoryColor, HistoryPrice } from '@/pages/procurement/lib/types';
import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';

export interface ExcelFileData {
  data: (string | number)[][];
  filename: string;
  sheetName?: string;
  supplierId: string;
  productIds: string[];
}

export const IDS_SHEET_NAME = 'IDs';
export const ORDER_SHEET_NAME = 'Order';

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

export async function downloadXlsxAsZip(
  files: ExcelFileData[],
  zipFilename: string = 'excel_files.zip',
): Promise<void> {
  if (!files || files.length === 0) {
    console.error('No files data provided to zip.');
    return;
  }

  if (!zipFilename.toLowerCase().endsWith('.zip')) {
    zipFilename += '.zip';
  }

  const zip = new JSZip();
  let filesAddedCount = 0;

  // eslint-disable-next-line no-restricted-syntax
  for (const fileInfo of files) {
    if (
      !fileInfo ||
      typeof fileInfo !== 'object' ||
      !fileInfo.filename ||
      !Array.isArray(fileInfo.data)
    ) {
      console.warn('Skipping invalid file data structure:', fileInfo);
      // eslint-disable-next-line no-continue
      continue;
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
      zip.file(xlsxFilename, xlsxBlob, { binary: true });
      // eslint-disable-next-line no-plusplus
      filesAddedCount++;
    } else {
      console.warn(
        `Failed to generate Excel file for ${fileInfo.filename}. Skipping this file.`,
      );
    }
  }

  if (filesAddedCount === 0) {
    console.error(
      'No valid Excel files could be generated or added to the zip archive.',
    );
    return;
  }

  try {
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6,
      },
      mimeType: 'application/zip',
    });

    const link = document.createElement('a');
    const url = URL.createObjectURL(zipBlob);

    link.setAttribute('href', url);
    link.setAttribute('download', zipFilename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating or downloading the zip file:', error);
  }
}

export const dayMonthYearFromDate = (date: Date) => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const formattedDay = String(day).padStart(2, '0');
  const formattedMonth = String(month).padStart(2, '0');
  return `${formattedDay}-${formattedMonth}-${year}`;
};

export const handleFilesSelected = async (
  orderId: string,
  event: React.ChangeEvent<HTMLInputElement>,
): Promise<HistoryPrice> => {
  const files = event.target.files;
  const historyPrice: HistoryPrice = {};
  await Promise.all(
    Array.from(files).map(async (file) => {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      // There are two sheets in the uploaded excel files:
      // - 'Order' sheet contains: ['Product Name', 'Quantity', 'Price'] columns
      // - 'IDs' sheet contains: ['Supplier ID', 'Product IDs'] columns
      // 'IDs' sheet is superhidden meaning it can be accessed only programmatically
      let supplierId: string = '';
      const productIds: string[] = [];
      const idsSheet = workbook.getWorksheet(IDS_SHEET_NAME);
      if (idsSheet) {
        idsSheet.eachRow((row: ExcelJS.Row, rowNumber) => {
          // ExcelJS Row numbering starts from 1
          // rowNumber 1 is header
          if (rowNumber === 1) {
            return;
          }
          const values = row.values as ExcelJS.CellValue[];
          // rowNumber 2 contains the supplier ID
          // each excel file is from a single supplier
          if (rowNumber === 2) {
            supplierId = values[1] as string;
          }
          productIds.push(values[2] as string);
        });
      }

      const orderSheet = workbook.getWorksheet(ORDER_SHEET_NAME);
      if (orderSheet) {
        orderSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) {
            return;
          }
          const values = row.values as ExcelJS.CellValue[];
          let price: number | undefined;
          try {
            price = parseInt(values[3].toString(), 10);
          } catch (error) {
            console.error('Error parsing price:', error);
          }
          const key = JSON.stringify({
            orderId,
            productId: productIds[rowNumber - 2],
            supplierId,
          });
          historyPrice[key] = {
            value: Number.isNaN(price) ? undefined : price,
            color: undefined,
          };
        });
      }
    }),
  );
  return historyPrice;
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
  // reset prev colors
  const resetPrices = { ...prices };
  Object.keys(resetPrices).forEach((key) => {
    resetPrices[key].color = undefined;
  });

  // partition prices into a 2D table
  const partitionedPrices: HistoryPrice[][] = [];
  productIds.forEach((productId) => {
    const row: HistoryPrice[] = [];
    supplierIds.forEach((supplierId) => {
      const key = JSON.stringify({
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
      if (priceColorPair.value === minPrice && !minFound) {
        minFound = true;
        return {
          [hash]: {
            value: priceColorPair.value,
            color: 'green' as HistoryColor,
          },
        };
      }
      if (priceColorPair.value === maxPrice && !maxFound) {
        maxFound = true;
        return {
          [hash]: {
            value: priceColorPair.value,
            color: 'orange' as HistoryColor,
          },
        };
      }
      return {
        [hash]: {
          value: priceColorPair.value,
          color: undefined,
        },
      };
    });
  });

  // create a new hash map from colored prices
  const updatedPrices: HistoryPrice = {};
  coloredPartitionedPrices.forEach((row) => {
    row.forEach((price) => {
      const [hash, priceColorPair] = Object.entries(price)[0];
      updatedPrices[hash] = priceColorPair;
    });
  });
  return updatedPrices;
};
