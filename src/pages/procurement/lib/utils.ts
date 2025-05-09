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
  editProductPrices,
  editProductQuantity,
  getHistory,
  getHistoryList,
  getProcurementProducts,
  getSuppliers,
} from '@/pages/procurement/lib/apis';
import { HistoryColor, HistoryPrice } from '@/pages/procurement/lib/types';
import {
  ProcurementOrder,
  ProcurementOrderProductQuantity,
  ProcurementProduct,
  ProcurementSupplier,
  ProcurementSupplierProductPrice,
} from '@prisma/client';
import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { Dispatch, SetStateAction } from 'react';

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
    if (success) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'success',
        severity: 'success',
      });
      return data;
    }
    console.error(message);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'failedToUpdateQuantity',
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

export async function editProductPricesUtil({
  accessToken,
  updatedPrices,
  setSnackbarMessage,
  setSnackbarOpen,
}: {
  accessToken: string;
  updatedPrices: Partial<ProcurementSupplierProductPrice>[];
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
}) {
  try {
    const { success, message } = await editProductPrices({
      accessToken,
      updatedPrices,
    });
    if (success) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'success',
        severity: 'success',
      });
    }
    console.error(message);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'failedToUpdateQuantity',
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

export async function getHistoryUtil({
  accessToken,
  id,
  setSelectedHistory,
  setSelectedSuppliers,
  setSelectedProducts,
  setSnackbarOpen,
  setSnackbarMessage,
  setProductQuantities,
}: {
  accessToken: string;
  id: string;
  setSelectedHistory: Dispatch<SetStateAction<ProcurementOrder>>;
  setSelectedSuppliers: Dispatch<SetStateAction<ProcurementSupplier[]>>;
  setSelectedProducts: Dispatch<SetStateAction<ProcurementProduct[]>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setProductQuantities: Dispatch<
    SetStateAction<ProcurementOrderProductQuantity[]>
  >;
}) {
  try {
    const { success, data, message } = await getHistory(accessToken, id);
    if (success) {
      setSelectedProducts(data.products ?? []);
      setSelectedSuppliers(data.suppliers ?? []);
      setProductQuantities(data.productQuantities ?? []);
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

export async function deleteHistoryUtil(
  accessToken: string,
  id: string,
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>,
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>,
): Promise<ProcurementOrder | undefined> {
  try {
    const { success, data, message } = await deleteHistory(accessToken, id);
    if (success) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'deleteItemSuccess',
        severity: 'success',
      });
      return data;
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

      let supplierId: string = '';
      const productIds: string[] = [];
      const idsSheet = workbook.getWorksheet(IDS_SHEET_NAME);
      if (idsSheet) {
        idsSheet.eachRow((row: ExcelJS.Row, rowNumber) => {
          if (rowNumber === 1) {
            return;
          }
          const values = row.values as ExcelJS.CellValue[];
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
  const partitionedPrices: HistoryPrice[][] = [];
  productIds.forEach((productId) => {
    const row: HistoryPrice[] = [];
    supplierIds.forEach((supplierId) => {
      const key = JSON.stringify({
        orderId,
        productId,
        supplierId,
      });
      row.push({ [key]: prices[key] });
    });
    partitionedPrices.push(row);
  });
  const coloredPartitionedPrices = partitionedPrices.map((row) => {
    const definedPrices = row.filter(
      (price) => Object.values(price)[0].value != null,
    );
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
            color: 'red' as HistoryColor,
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

  const updatedPrices: HistoryPrice = {};
  coloredPartitionedPrices.forEach((row) => {
    row.forEach((price) => {
      const [hash, priceColorPair] = Object.entries(price)[0];
      updatedPrices[hash] = priceColorPair;
    });
  });
  return updatedPrices;
};
