import { FetchWithCredsType, SnackbarProps } from '@/pages/lib/types';
import {
  createHistory,
  createProcurementProduct,
  createProductQuantity,
  createSupplier,
  deleteHistory,
  deletePrices,
  deleteProduct,
  deleteQuantity,
  deleteSupplier,
  editHistory,
  editProduct,
  editProductPrices,
  editProductQuantity,
  editSupplier,
  getHistory,
  getHistoryList,
  getProcurementProducts,
  getSuppliers,
} from '@/pages/procurement/lib/apis';
import {
  ProcurementOrder,
  ProcurementOrderProductQuantity,
  ProcurementProduct,
  ProcurementSupplier,
  ProcurementSupplierProductPrice,
} from '@prisma/client';
import { Dispatch, SetStateAction } from 'react';

export async function handleProductSearchUtil({
  accessToken,
  keyword,
  setProducts,
  setSnackbarMessage,
  setSnackbarOpen,
  fetchWithCreds,
}: {
  accessToken: string;
  keyword: string;
  setProducts: Dispatch<SetStateAction<ProcurementProduct[]>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}) {
  try {
    const { success, data, message } = await getProcurementProducts({
      accessToken,
      searchKeyword: keyword,
      fetchWithCreds,
    });
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

export async function handleSupplierSearchUtil({
  accessToken,
  fetchWithCreds,
  keyword,
  setSnackbarMessage,
  setSnackbarOpen,
  setSuppliers,
}: {
  accessToken: string;
  keyword: string;
  setSuppliers: Dispatch<SetStateAction<ProcurementSupplier[]>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}) {
  try {
    const { success, data, message } = await getSuppliers({
      accessToken,
      searchKeyword: keyword,
      fetchWithCreds,
    });
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

export async function createProductUtil({
  accessToken,
  keyword,
  setProducts,
  setSnackbarMessage,
  setSnackbarOpen,
  fetchWithCreds,
}: {
  accessToken: string;
  keyword: string;
  setProducts: Dispatch<SetStateAction<ProcurementProduct[]>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}) {
  if (keyword == null || keyword === '') {
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'nameRequired',
      severity: 'error',
    });
    return;
  }

  try {
    const { success, data, message } = await createProcurementProduct({
      accessToken,
      name: keyword,
      fetchWithCreds,
    });
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
  fetchWithCreds,
}: {
  accessToken: string;
  orderId: string;
  productId: string;
  quantity?: number;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ProcurementOrderProductQuantity | undefined> {
  try {
    const { success, data, message } = await createProductQuantity({
      accessToken,
      orderId,
      productId,
      quantity,
      fetchWithCreds,
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

export async function createHistoryUtil({
  accessToken,
  fetchWithCreds,
  name,
  setHistory,
  setSelectedHistory,
  setSnackbarMessage,
  setSnackbarOpen,
}: {
  accessToken: string;
  name: string;
  setHistory: Dispatch<SetStateAction<ProcurementOrder[]>>;
  setSelectedHistory: Dispatch<SetStateAction<ProcurementOrder>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}) {
  try {
    const { success, data, message } = await createHistory({
      accessToken,
      fetchWithCreds,
      name,
    });
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
  fetchWithCreds,
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
  fetchWithCreds: FetchWithCredsType;
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
      fetchWithCreds,
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
  fetchWithCreds,
}: {
  accessToken: string;
  orderId: string;
  productId: string;
  quantity: number;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ProcurementOrderProductQuantity | undefined> {
  try {
    const { success, data, message } = await editProductQuantity({
      accessToken,
      orderId,
      productId,
      quantity,
      fetchWithCreds,
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

export async function editProductUtil({
  accessToken,
  id,
  name,
  setSnackbarMessage,
  setSnackbarOpen,
  fetchWithCreds,
}: {
  accessToken: string;
  id: string;
  name: string;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ProcurementProduct | undefined> {
  try {
    const {
      success,
      data: editedProduct,
      message,
    } = await editProduct({
      accessToken,
      id,
      name,
      fetchWithCreds,
    });
    if (success) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'success',
        severity: 'success',
      });
      return editedProduct;
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

export async function editSupplierUtil({
  accessToken,
  id,
  name,
  setSnackbarMessage,
  setSnackbarOpen,
  fetchWithCreds,
  description,
}: {
  accessToken: string;
  id: string;
  name: string;
  description?: string;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ProcurementSupplier | undefined> {
  try {
    const {
      success,
      data: editedSupplier,
      message,
    } = await editSupplier({
      accessToken,
      id,
      name,
      description,
      fetchWithCreds,
    });
    if (success) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'success',
        severity: 'success',
      });
      return editedSupplier;
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
  fetchWithCreds,
}: {
  accessToken: string;
  updatedPrices: Partial<ProcurementSupplierProductPrice>[];
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}): Promise<boolean> {
  try {
    const { success, message } = await editProductPrices({
      accessToken,
      updatedPrices,
      fetchWithCreds,
    });
    if (success) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'success',
        severity: 'success',
      });
    } else {
      console.error(message);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'failedToUpdateQuantity',
        severity: 'error',
      });
    }
    return success;
  } catch (error) {
    console.error(error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'serverError',
      severity: 'error',
    });
  }
  return false;
}

export async function createSupplierUtil({
  accessToken,
  fetchWithCreds,
  keyword,
  setSnackbarMessage,
  setSnackbarOpen,
  setSupplier,
}: {
  accessToken: string;
  keyword: string;
  setSupplier: Dispatch<SetStateAction<ProcurementSupplier[]>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}) {
  if (keyword == null || keyword === '') {
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'nameRequired',
      severity: 'error',
    });
    return;
  }

  try {
    const { success, data, message } = await createSupplier({
      accessToken,
      name: keyword,
      fetchWithCreds,
    });
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

export async function getProductsUtil({
  accessToken,
  fetchWithCreds,
  setProducts,
  setSnackbarMessage,
  setSnackbarOpen,
}: {
  accessToken: string;
  setProducts: Dispatch<SetStateAction<ProcurementProduct[]>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}) {
  try {
    const { success, data, message } = await getProcurementProducts({
      accessToken,
      fetchWithCreds,
    });
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

export async function getHistoryListUtil({
  accessToken,
  fetchWithCreds,
  setHistoryList,
  setSnackbarMessage,
  setSnackbarOpen,
}: {
  accessToken: string;
  setHistoryList: Dispatch<SetStateAction<ProcurementOrder[]>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ProcurementOrder | undefined> {
  try {
    const { success, data, message } = await getHistoryList({
      accessToken,
      fetchWithCreds,
    });
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
  fetchWithCreds,
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
  fetchWithCreds: FetchWithCredsType;
}) {
  try {
    const { success, data, message } = await getHistory({
      accessToken,
      id,
      fetchWithCreds,
    });
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

export async function getSuppliersUtil({
  accessToken,
  fetchWithCreds,
  setSnackbarMessage,
  setSnackbarOpen,
  setSuppliers,
}: {
  accessToken: string;
  setSuppliers: Dispatch<SetStateAction<ProcurementProduct[]>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}) {
  try {
    const { success, data, message } = await getSuppliers({
      accessToken,
      fetchWithCreds,
    });
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

export async function deleteSupplierUtil({
  accessToken,
  fetchWithCreds,
  id,
  setSnackbarMessage,
  setSnackbarOpen,
}: {
  accessToken: string;
  id: string;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ProcurementSupplier | undefined> {
  try {
    const { success, data, message } = await deleteSupplier({
      accessToken,
      id,
      fetchWithCreds,
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

export async function deleteQuantityUtil({
  accessToken,
  orderId,
  productId,
  setSnackbarMessage,
  setSnackbarOpen,
  fetchWithCreds,
}: {
  accessToken: string;
  orderId: string;
  productId: string;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ProcurementOrderProductQuantity | undefined> {
  try {
    const { success, data, message } = await deleteQuantity({
      accessToken,
      orderId,
      productId,
      fetchWithCreds,
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

export async function deleteHistoryUtil({
  accessToken,
  fetchWithCreds,
  id,
  setSnackbarMessage,
  setSnackbarOpen,
}: {
  accessToken: string;
  id: string;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ProcurementOrder | undefined> {
  try {
    const { success, data, message } = await deleteHistory({
      accessToken,
      id,
      fetchWithCreds,
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

export async function deleteProductUtil({
  accessToken,
  fetchWithCreds,
  id,
  setSnackbarMessage,
  setSnackbarOpen,
}: {
  accessToken: string;
  id: string;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ProcurementProduct | undefined> {
  try {
    const { success, data, message } = await deleteProduct({
      accessToken,
      id,
      fetchWithCreds,
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

export async function deletePricesUtil({
  accessToken,
  ids,
  setSnackbarMessage,
  setSnackbarOpen,
  fetchWithCreds,
}: {
  accessToken: string;
  ids: Partial<ProcurementSupplierProductPrice>[];
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  fetchWithCreds: FetchWithCredsType;
}): Promise<boolean> {
  try {
    const { success, message } = await deletePrices({
      accessToken,
      ids,
      fetchWithCreds,
    });
    if (success) {
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
    return success;
  } catch (error) {
    console.error(error);
    setSnackbarOpen(true);
    setSnackbarMessage({
      message: 'serverError',
      severity: 'error',
    });
  }

  return false;
}
