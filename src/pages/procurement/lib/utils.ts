import { SnackbarProps } from '@/pages/lib/types';
import {
  createHistory,
  createProcurementProduct,
  createSupplier,
  deleteProduct,
  deleteSupplier,
  getHistory,
  getHistoryList,
  getProcurementProducts,
  getSuppliers,
} from '@/pages/procurement/lib/apis';
import { HistoryPrice } from '@/pages/procurement/lib/types';
import {
  CalculationEntry,
  CalculationHistory,
  ProcurementProduct,
  Supplier,
} from '@prisma/client';
import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { Dispatch, SetStateAction } from 'react';

export interface ExcelFileData {
  data: (string | number)[][];
  filename: string;
  sheetName?: string;
}

async function arrayToXlsxBlob(
  data: any[][],
  sheetName: string = 'Sheet 1',
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

    const worksheet = workbook.addWorksheet(sheetName);
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

    const buffer = await workbook.xlsx.writeBuffer();

    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  } catch (error) {
    console.error(
      `Error generating Excel Blob for sheet "${sheetName}":`,
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

    const xlsxBlob = await arrayToXlsxBlob(fileInfo.data, fileInfo.sheetName);

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

export async function handleProductSearchUtil(
  accessToken: string,
  keyword: string,
  setProducts: Dispatch<SetStateAction<ProcurementProduct[]>>,
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>,
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>,
) {
  try {
    const { success, data, message } = await getProcurementProducts(
      accessToken,
      keyword,
    );
    if (success) {
      setProducts(data);
    } else {
      console.error(message);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'serverError',
        severity: 'error',
      });
    }
  } catch (error) {
    console.error(error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'fetchPricesError',
      severity: 'error',
    });
  }
}

export async function handleSupplierSearchUtil(
  accessToken: string,
  keyword: string,
  setSuppliers: Dispatch<SetStateAction<Supplier[]>>,
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>,
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>,
) {
  try {
    const { success, data, message } = await getSuppliers(accessToken, keyword);
    if (success) {
      setSuppliers(data);
    } else {
      console.error(message);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'serverError',
        severity: 'error',
      });
    }
  } catch (error) {
    console.error(error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'fetchPricesError',
      severity: 'error',
    });
  }
}

export async function createProductUtil(
  accessToken: string,
  keyword: string,
  setProducts: Dispatch<SetStateAction<ProcurementProduct[]>>,
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>,
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>,
) {
  if (keyword == null || keyword === '') {
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'nameRequired',
      severity: 'error',
    });
    return;
  }

  try {
    const { success, data, message } = await createProcurementProduct(
      accessToken,
      keyword,
    );
    if (success) {
      setProducts([data]);
    } else {
      console.error(message);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'serverError',
        severity: 'error',
      });
    }
  } catch (error) {
    console.error(error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'serverError',
      severity: 'error',
    });
  }
}

export async function createHistoryUtil(
  accessToken: string,
  name: string,
  suppliers: Supplier[],
  products: ProcurementProduct[],
  setHistory: Dispatch<SetStateAction<CalculationHistory[]>>,
  setSelectedHistory: Dispatch<SetStateAction<CalculationHistory>>,
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>,
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>,
) {
  try {
    const { success, data, message } = await createHistory(
      accessToken,
      name,
      suppliers.map((supplier) => supplier.id),
      products.map((product) => product.id),
    );
    if (success) {
      setSelectedHistory(data);
      setHistory((current) => [data, ...current]);
    } else {
      console.error(message);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'serverError',
        severity: 'error',
      });
    }
  } catch (error) {
    console.error(error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'serverError',
      severity: 'error',
    });
  }
}

export async function createSupplierUtil(
  accessToken: string,
  keyword: string,
  setSupplier: Dispatch<SetStateAction<Supplier[]>>,
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>,
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>,
) {
  if (keyword == null || keyword === '') {
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'nameRequired',
      severity: 'error',
    });
    return;
  }

  try {
    const { success, data, message } = await createSupplier(
      accessToken,
      keyword,
    );
    if (success) {
      setSupplier([data]);
    } else {
      console.error(message);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'serverError',
        severity: 'error',
      });
    }
  } catch (error) {
    console.error(error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'serverError',
      severity: 'error',
    });
  }
}

export async function getProductsUtil(
  accessToken: string,
  setProducts: Dispatch<SetStateAction<ProcurementProduct[]>>,
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>,
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>,
) {
  try {
    const { success, data, message } =
      await getProcurementProducts(accessToken);
    if (success) {
      setProducts(data);
    } else {
      console.error(message);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'serverError',
        severity: 'error',
      });
    }
  } catch (error) {
    console.error(error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'serverError',
      severity: 'error',
    });
  }
}

export async function getHistoryListUtil(
  accessToken: string,
  setHistoryList: Dispatch<SetStateAction<CalculationHistory[]>>,
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>,
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>,
) {
  try {
    const { success, data, message } = await getHistoryList(accessToken);
    if (success) {
      setHistoryList(data);
    } else {
      console.error(message);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'serverError',
        severity: 'error',
      });
    }
  } catch (error) {
    console.error(error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'serverError',
      severity: 'error',
    });
  }
}

export async function getHistoryUtil(
  accessToken: string,
  id: string,
  setSelectedHistory: Dispatch<SetStateAction<CalculationHistory>>,
  setSelectedSuppliers: Dispatch<SetStateAction<Supplier[]>>,
  setSelectedProducts: Dispatch<SetStateAction<ProcurementProduct[]>>,
  setInitialHistoryPrices: Dispatch<SetStateAction<CalculationEntry[]>>,
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>,
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>,
) {
  try {
    const { success, data, message } = await getHistory(accessToken, id);
    if (success) {
      setSelectedProducts(data.procurementProducts);
      setSelectedSuppliers(data.suppliers);
      setInitialHistoryPrices(data.calculationEntries);
      setSelectedHistory(data);
    } else {
      console.error(message);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'serverError',
        severity: 'error',
      });
    }
  } catch (error) {
    console.error(error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'serverError',
      severity: 'error',
    });
  }
}

export async function getSuppliersUtil(
  accessToken: string,
  setSuppliers: Dispatch<SetStateAction<ProcurementProduct[]>>,
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>,
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>,
) {
  try {
    const { success, data, message } = await getSuppliers(accessToken);
    if (success) {
      setSuppliers(data);
    } else {
      console.error(message);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'serverError',
        severity: 'error',
      });
    }
  } catch (error) {
    console.error(error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'serverError',
      severity: 'error',
    });
  }
}

export async function deleteSupplierUtil(
  accessToken: string,
  id: string,
  setSuppliers: Dispatch<SetStateAction<Supplier[]>>,
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>,
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>,
) {
  try {
    const { success, message } = await deleteSupplier(accessToken, id);
    if (success) {
      setSuppliers((prev) => prev.filter((supplier) => supplier.id !== id));
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'deleteItemSuccess',
        severity: 'success',
      });
    } else {
      console.error(message);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'serverError',
        severity: 'error',
      });
    }
  } catch (error) {
    console.error(error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'serverError',
      severity: 'error',
    });
  }
}

export async function deleteProductUtil(
  accessToken: string,
  id: string,
  setProducts: Dispatch<SetStateAction<Supplier[]>>,
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>,
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>,
) {
  try {
    const { success, message } = await deleteProduct(accessToken, id);
    if (success) {
      setProducts((prev) => prev.filter((product) => product.id !== id));
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'deleteItemSuccess',
        severity: 'success',
      });
    } else {
      console.error(message);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'serverError',
        severity: 'error',
      });
    }
  } catch (error) {
    console.error(error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'serverError',
      severity: 'error',
    });
  }
}

export const emptyHistoryPrices = (
  products: ProcurementProduct[],
  suppliers: Supplier[],
) => Array.from({ length: products.length }, () => Array(suppliers.length));

export function parseInitialHistoryPrices(
  entries: CalculationEntry[],
  suppliers: Supplier[],
  products: ProcurementProduct[],
  setPrices: Dispatch<SetStateAction<HistoryPrice[][]>>,
) {
  const supplierMap: { [id: string]: number } = {};
  const productMap: { [id: string]: number } = {};

  suppliers.forEach((supplier, idx) => {
    supplierMap[supplier.id] = idx;
  });
  products.forEach((product, idx) => {
    productMap[product.id] = idx;
  });

  const prices = emptyHistoryPrices(products, suppliers);
  entries.forEach((entry) => {
    const col = supplierMap[entry.supplierId];
    const row = productMap[entry.procurementProductId];
    prices[row][col] = entry.price;
  });
  setPrices(prices);
}
