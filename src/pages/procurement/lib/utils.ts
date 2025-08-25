import { HistoryPrice } from '@/pages/procurement/lib/types';
import { OrderPriceColor } from '@prisma/client';
import * as ExcelJS from 'exceljs';

export const IDS_SHEET_NAME = 'IDs';
export const ORDER_SHEET_NAME = 'Order';

// Validation utilities
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExcelValidationResult extends ValidationResult {
  fileSize: number;
  sheetCount: number;
  hasRequiredSheets: boolean;
}

export const validatePrice = (
  value: any,
): { price: number | null; error: string | null } => {
  if (value === null || value === undefined || value === '') {
    return { price: null, error: null };
  }

  // Convert to string and clean up
  const stringValue = String(value).trim();

  // Remove common currency symbols and whitespace
  const cleanedValue = stringValue.replace(/[$,\s€£¥]/g, '');

  // Check for invalid characters (only numbers, decimal point, and minus sign allowed)
  if (!/^-?\d*\.?\d+$/.test(cleanedValue)) {
    return { price: null, error: `Неверный формат цены: "${stringValue}"` };
  }

  const parsed = parseFloat(cleanedValue);

  // Check if parsing resulted in NaN
  if (Number.isNaN(parsed)) {
    return {
      price: null,
      error: `Не удается распознать цену: "${stringValue}"`,
    };
  }

  // Check for negative prices (assuming procurement prices should be positive)
  if (parsed < 0) {
    return {
      price: null,
      error: `Цена не может быть отрицательной: ${parsed}`,
    };
  }

  // Check for unreasonably large prices (adjust this limit as needed)
  if (parsed > 1000000) {
    return { price: null, error: `Цена слишком большая: ${parsed}` };
  }

  // Round to 2 decimal places for currency
  const roundedPrice = Math.round(parsed * 100) / 100;

  return { price: roundedPrice, error: null };
};

export const validateQuantity = (
  value: any,
): { quantity: number | null; error: string | null } => {
  if (value === null || value === undefined || value === '') {
    return { quantity: null, error: null };
  }

  const stringValue = String(value).trim();
  const parsed = parseInt(stringValue, 10);

  if (Number.isNaN(parsed)) {
    return { quantity: null, error: `Неверное количество: "${stringValue}"` };
  }

  if (parsed < 0) {
    return {
      quantity: null,
      error: `Количество не может быть отрицательным: ${parsed}`,
    };
  }

  if (parsed > 1000000) {
    return {
      quantity: null,
      error: `Количество слишком большое: ${parsed}`,
    };
  }

  return { quantity: parsed, error: null };
};

export const validateExcelFile = async (
  file: File,
): Promise<ExcelValidationResult> => {
  const result: ExcelValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    fileSize: file.size,
    sheetCount: 0,
    hasRequiredSheets: false,
  };

  // Check file size (max 10MB)
  const maxFileSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxFileSize) {
    result.errors.push(
      `Размер файла (${(file.size / 1024 / 1024).toFixed(2)}МБ) превышает максимально допустимый размер (10МБ)`,
    );
    result.isValid = false;
  }

  // Check file extension
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    result.errors.push('Файл должен быть в формате Excel (.xlsx)');
    result.isValid = false;
  }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    result.sheetCount = workbook.worksheets.length;

    // Check for required sheets
    const orderSheet = workbook.getWorksheet(ORDER_SHEET_NAME);
    const idsSheet = workbook.getWorksheet(IDS_SHEET_NAME);

    if (!orderSheet) {
      result.errors.push(
        `Отсутствует обязательный лист: "${ORDER_SHEET_NAME}"`,
      );
      result.isValid = false;
    }

    if (!idsSheet) {
      result.errors.push(`Отсутствует обязательный лист: "${IDS_SHEET_NAME}"`);
      result.isValid = false;
    }

    result.hasRequiredSheets = !!(orderSheet && idsSheet);

    if (result.hasRequiredSheets) {
      // Validate Order sheet structure
      const headerRow = orderSheet.getRow(1);
      const expectedHeaders = ['', 'Quantity', 'Price']; // First column is product name

      for (let i = 0; i < expectedHeaders.length; i += 1) {
        const cellValue = headerRow.getCell(i + 1).value;
        if (cellValue !== expectedHeaders[i]) {
          result.warnings.push(
            `Ожидался заголовок "${expectedHeaders[i]}" в колонке ${i + 1}, найден "${cellValue}"`,
          );
        }
      }

      // Check if order sheet has data rows
      if (orderSheet.rowCount <= 1) {
        result.warnings.push('Лист заказа пустой (нет данных)');
      }

      // Validate IDs sheet structure
      const idsHeaderRow = idsSheet.getRow(1);
      const expectedIdsHeaders = ['supplierId', 'productId'];

      for (let i = 0; i < expectedIdsHeaders.length; i += 1) {
        const cellValue = idsHeaderRow.getCell(i + 1).value;
        if (cellValue !== expectedIdsHeaders[i]) {
          result.warnings.push(
            `Ожидался заголовок ID "${expectedIdsHeaders[i]}" в колонке ${i + 1}, найден "${cellValue}"`,
          );
        }
      }

      // Check if IDs sheet has data
      if (idsSheet.rowCount <= 1) {
        result.errors.push('Лист ID пустой (нет данных)');
        result.isValid = false;
      }
    }
  } catch (error) {
    result.errors.push(`Ошибка чтения Excel файла: ${error.message}`);
    result.isValid = false;
  }

  return result;
};

export interface ExcelFileData {
  data: (string | number)[][];
  filename: string;
  sheetName?: string;
  supplierId: string;
  productIds: string[];
}

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

export const handleFilesSelected = async (
  orderId: string,
  event: React.ChangeEvent<HTMLInputElement>,
): Promise<{
  historyPrice: HistoryPrice;
  errors: string[];
  warnings: string[];
}> => {
  const files = event.target.files;
  const historyPrice: HistoryPrice = {};
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  if (!files || files.length === 0) {
    return { historyPrice, errors: ['Файлы не выбраны'], warnings: [] };
  }

  await Promise.all(
    Array.from(files).map(async (file) => {
      const fileErrors: string[] = [];
      const fileWarnings: string[] = [];

      // Validate the Excel file first
      const validation = await validateExcelFile(file);
      if (!validation.isValid) {
        fileErrors.push(`Файл "${file.name}": ${validation.errors.join(', ')}`);
        allErrors.push(...fileErrors);
        return;
      }

      if (validation.warnings.length > 0) {
        fileWarnings.push(
          `Файл "${file.name}": ${validation.warnings.join(', ')}`,
        );
        allWarnings.push(...fileWarnings);
      }

      try {
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
              if (!supplierId) {
                fileErrors.push(
                  `Отсутствует ID поставщика в файле "${file.name}"`,
                );
              }
            }
            const productId = values[2] as string;
            if (!productId) {
              fileWarnings.push(
                `Отсутствует ID продукта в строке ${rowNumber} файла "${file.name}"`,
              );
            } else {
              productIds.push(productId);
            }
          });
        }

        const orderSheet = workbook.getWorksheet(ORDER_SHEET_NAME);
        if (orderSheet) {
          orderSheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) {
              return; // Skip header row
            }

            const values = row.values as ExcelJS.CellValue[];
            const productIndex = rowNumber - 2; // Convert to 0-based index for productIds array

            if (productIndex >= productIds.length) {
              fileWarnings.push(
                `Строка ${rowNumber} в "${file.name}" не имеет соответствующего ID продукта`,
              );
              return;
            }

            const productId = productIds[productIndex];
            if (!productId) {
              fileWarnings.push(
                `Отсутствует ID продукта для строки ${rowNumber} в "${file.name}"`,
              );
              return;
            }

            // Validate and parse price using our new robust function
            const priceValidation = validatePrice(values[3]);

            if (priceValidation.error) {
              fileWarnings.push(
                `Строка ${rowNumber} в "${file.name}": ${priceValidation.error}`,
              );
            }

            const key = priceHash({
              orderId,
              productId,
              supplierId,
            });

            historyPrice[key] = {
              value: priceValidation.price,
              color: undefined,
            };
          });
        }

        // Add file-specific errors and warnings to the overall collection
        if (fileErrors.length > 0) {
          allErrors.push(...fileErrors);
        }
        if (fileWarnings.length > 0) {
          allWarnings.push(...fileWarnings);
        }
      } catch (error) {
        const errorMessage = `Ошибка обработки файла "${file.name}": ${error.message}`;
        allErrors.push(errorMessage);
        console.error(errorMessage, error);
      }
    }),
  );

  return { historyPrice, errors: allErrors, warnings: allWarnings };
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
