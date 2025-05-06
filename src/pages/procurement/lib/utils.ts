import { SnackbarProps } from '@/pages/lib/types';
import {
  createHistory,
  createProcurementProduct,
  createProductQuantity,
  createSupplier,
  deleteHistory,
  deleteProduct,
  deleteProductQuantity,
  deleteSupplier,
  editHistory,
  editProductQuantity,
  getHistory,
  getHistoryList,
  getProcurementProducts,
  getSuppliers,
} from '@/pages/procurement/lib/apis';
import { HistoryPrice } from '@/pages/procurement/lib/types';
import {
  ProcurementOrder,
  ProcurementOrderProductQuantity,
  ProcurementProduct,
  ProcurementSupplier,
} from '@prisma/client';
import { JsonValue } from '@prisma/client/runtime/library';
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
  setSuppliers: Dispatch<SetStateAction<ProcurementSupplier[]>>,
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
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'success',
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

export async function createProductQuantityUtil({
  accessToken,
  orderId,
  productId,
  quantity,
  setSnackbarMessage,
  setSnackbarOpen,
}: {
  accessToken: string;
  orderId: string;
  productId: string;
  quantity: number;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
}): Promise<ProcurementOrderProductQuantity | undefined> {
  try {
    const { success, data, message } = await createProductQuantity({
      accessToken,
      orderId,
      productId,
      quantity,
    });
    if (success) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'success',
        severity: 'success',
      });
      return data;
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

  return undefined;
}

export async function createHistoryUtil(
  accessToken: string,
  name: string,
  setHistory: Dispatch<SetStateAction<ProcurementOrder[]>>,
  setSelectedHistory: Dispatch<SetStateAction<ProcurementOrder>>,
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>,
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>,
) {
  try {
    const { success, data, message } = await createHistory(accessToken, name);
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

export async function editHistoryUtil({
  id,
  accessToken,
  name,
  addedProductIds,
  removedProductIds,
  addedSupplierIds,
  removedSupplierIds,
  setSnackbarMessage,
  setSnackbarOpen,
  setHistoryList,
}: {
  id: string;
  accessToken: string;
  name?: string;
  addedProductIds?: string[];
  removedProductIds?: string[];
  addedSupplierIds?: string[];
  removedSupplierIds?: string[];
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setHistoryList?: Dispatch<SetStateAction<ProcurementOrder[]>>;
}): Promise<ProcurementOrder | undefined> {
  try {
    const { success, data, message } = await editHistory({
      accessToken,
      id,
      name,
      addedProductIds,
      removedProductIds,
      addedSupplierIds,
      removedSupplierIds,
    });
    if (success) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'success',
        severity: 'success',
      });
      return data;
    } else {
      console.error(message);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'serverError',
        severity: 'error',
      });
      if (setHistoryList) {
        setHistoryList((prev) =>
          prev.map((history) => {
            if (history.id === id) {
              return data;
            }
            return history;
          }),
        );
      }
    }
  } catch (error) {
    console.error(error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'serverError',
      severity: 'error',
    });
  }

  return undefined;
}

export async function editProductQuantityUtil({
  accessToken,
  orderId,
  productId,
  quantity,
  setSnackbarMessage,
  setSnackbarOpen,
}: {
  accessToken: string;
  orderId: string;
  productId: string;
  quantity: number;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
}): Promise<ProcurementOrderProductQuantity | undefined> {
  try {
    const { success, data, message } = await editProductQuantity({
      accessToken,
      orderId,
      productId,
      quantity,
    });
    if (!success) {
      console.error(message);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'failedToUpdateQuantity',
        severity: 'error',
      });
      return data;
    } else {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'success',
        severity: 'success',
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

  return undefined;
}

export async function createSupplierUtil(
  accessToken: string,
  keyword: string,
  setSupplier: Dispatch<SetStateAction<ProcurementSupplier[]>>,
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
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'success',
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

// returns latest created history
export async function getHistoryListUtil(
  accessToken: string,
  setHistoryList: Dispatch<SetStateAction<ProcurementOrder[]>>,
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>,
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>,
): Promise<ProcurementOrder | undefined> {
  try {
    const { success, data, message } = await getHistoryList(accessToken);
    if (success) {
      setHistoryList(data);
      return data[0];
    }
    console.error(message);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'serverError',
      severity: 'error',
    });
  } catch (error) {
    console.error(error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'serverError',
      severity: 'error',
    });
  }
  return undefined;
}

export async function getHistoryUtil(
  accessToken: string,
  id: string,
  setSelectedHistory: Dispatch<SetStateAction<ProcurementOrder>>,
  setSelectedSuppliers: Dispatch<SetStateAction<ProcurementSupplier[]>>,
  setSelectedProducts: Dispatch<SetStateAction<ProcurementProduct[]>>,
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>,
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>,
) {
  try {
    const { success, data, message } = await getHistory(accessToken, id);
    if (success) {
      setSelectedProducts(data.products ?? []);
      setSelectedSuppliers(data.suppliers ?? []);
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
  setSuppliers: Dispatch<SetStateAction<ProcurementSupplier[]>>,
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

export async function deleteProductQuantityUtil({
  accessToken,
  orderId,
  productId,
  setSnackbarMessage,
  setSnackbarOpen,
}: {
  accessToken: string;
  orderId: string;
  productId: string;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
}): Promise<ProcurementOrderProductQuantity | undefined> {
  try {
    const { success, data, message } = await deleteProductQuantity({
      accessToken,
      orderId,
      productId,
    });
    if (success) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'deleteItemSuccess',
        severity: 'success',
      });
      return data;
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

  return undefined;
}

export async function deleteHistoryUtil(
  accessToken: string,
  id: string,
  setHistoryList: Dispatch<SetStateAction<ProcurementOrder[]>>,
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>,
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>,
) {
  try {
    const { success, message } = await deleteHistory(accessToken, id);
    if (success) {
      setHistoryList((prev) => prev.filter((history) => history.id !== id));
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
  setProducts: Dispatch<SetStateAction<ProcurementSupplier[]>>,
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
  suppliers: ProcurementSupplier[],
) => Array.from({ length: products.length }, () => Array(suppliers.length));

export const parseInitialHistoryPrices = (
  prices: JsonValue | null,
  products: ProcurementProduct[],
  suppliers: ProcurementSupplier[],
): HistoryPrice[][] => {
  if (!prices) return emptyHistoryPrices(products, suppliers);
  return (prices as number[][]).map((row) => {
    return (row as number[]).map((price: number) => {
      return {
        value: price,
      };
    });
  });
};

export const dayMonthYearFromDate = (date: Date) => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const formattedDay = String(day).padStart(2, '0');
  const formattedMonth = String(month).padStart(2, '0');
  return `${formattedDay}-${formattedMonth}-${year}`;
};
