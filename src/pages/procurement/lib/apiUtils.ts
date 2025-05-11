import { SnackbarProps } from '@/pages/lib/types';
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
  editProductPrices,
  editProductQuantity,
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
    } else {
      console.error(message);
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'failedToUpdateQuantity',
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

export async function deleteQuantityUtil({
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
    const { success, data, message } = await deleteQuantity({
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

export async function deletePricesUtil({
  accessToken,
  ids,
  setSnackbarMessage,
  setSnackbarOpen,
}: {
  accessToken: string;
  ids: Partial<ProcurementSupplierProductPrice>[];
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
}): Promise<boolean> {
  try {
    const { success, message } = await deletePrices(accessToken, ids);
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
