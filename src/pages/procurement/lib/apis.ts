import { FetchWithCredsType, ResponseApi } from '@/pages/lib/types';
import { DetailedOrder } from '@/pages/procurement/lib/types';
import {
  ProcurementOrder,
  ProcurementOrderProductQuantity,
  ProcurementProduct,
  ProcurementSupplier,
  ProcurementSupplierProductPrice,
} from '@prisma/client';

export const fetchSuppliers = async ({
  accessToken,
  fetchWithCreds,
}: {
  accessToken: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi<ProcurementSupplier[]>> => {
  return fetchWithCreds<ProcurementSupplier[]>({
    accessToken,
    path: '/api/procurement/supplier',
    method: 'GET',
  });
};

export const deleteSupplier = async ({
  accessToken,
  fetchWithCreds,
  id,
}: {
  accessToken: string;
  id: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi<ProcurementSupplier>> => {
  return fetchWithCreds<ProcurementSupplier>({
    accessToken,
    path: '/api/procurement/supplier',
    method: 'DELETE',
    body: { id },
  });
};

export const deletePrices = async ({
  accessToken,
  fetchWithCreds,
  ids,
}: {
  accessToken: string;
  ids: Partial<ProcurementSupplierProductPrice>[];
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi> => {
  return fetchWithCreds({
    accessToken,
    path: '/api/procurement/order/prices',
    method: 'DELETE',
    body: {
      ids,
    },
  });
};

export const deleteQuantity = async ({
  accessToken,
  orderId,
  productId,
  fetchWithCreds,
}: {
  accessToken: string;
  orderId: string;
  productId: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi<ProcurementOrderProductQuantity>> => {
  return fetchWithCreds<ProcurementOrderProductQuantity>({
    accessToken,
    path: '/api/procurement/order/quantities',
    method: 'DELETE',
    body: { orderId, productId },
  });
};

export const deleteHistory = async ({
  accessToken,
  fetchWithCreds,
  id,
}: {
  accessToken: string;
  id: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi<ProcurementSupplier>> => {
  return fetchWithCreds<ProcurementSupplier>({
    accessToken,
    path: '/api/procurement/order',
    method: 'DELETE',
    body: { id },
  });
};

export const deleteProduct = async ({
  accessToken,
  fetchWithCreds,
  id,
}: {
  accessToken: string;
  id: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi<ProcurementProduct>> => {
  return fetchWithCreds<ProcurementProduct>({
    accessToken,
    path: '/api/procurement/product',
    method: 'DELETE',
    body: { id },
  });
};

export const getProcurementProducts = async ({
  accessToken,
  fetchWithCreds,
  searchKeyword,
}: {
  accessToken: string;
  searchKeyword?: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi<ProcurementProduct[]>> => {
  let url = '/api/procurement/product';
  if (searchKeyword) {
    url += `?searchKeyword=${searchKeyword}`;
  }
  return fetchWithCreds<ProcurementProduct[]>({
    accessToken,
    path: url,
    method: 'GET',
  });
};

export const getSuppliers = async ({
  accessToken,
  fetchWithCreds,
  searchKeyword,
}: {
  accessToken: string;
  searchKeyword?: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi<ProcurementSupplier[]>> => {
  let url = '/api/procurement/supplier';
  if (searchKeyword) {
    url += `?searchKeyword=${searchKeyword}`;
  }
  return fetchWithCreds<ProcurementSupplier[]>({
    accessToken,
    path: url,
    method: 'GET',
  });
};

export const getHistoryList = async ({
  accessToken,
  fetchWithCreds,
}: {
  accessToken: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi<ProcurementOrder[]>> => {
  const url = '/api/procurement/order';
  return fetchWithCreds<ProcurementOrder[]>({
    accessToken,
    path: url,
    method: 'GET',
  });
};

export const getHistory = async ({
  accessToken,
  fetchWithCreds,
  id,
}: {
  accessToken: string;
  id: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi<DetailedOrder>> => {
  const url = `/api/procurement/order?id=${id}`;
  return fetchWithCreds<DetailedOrder>({
    accessToken,
    path: url,
    method: 'GET',
  });
};

export const editHistory = async ({
  accessToken,
  id,
  name,
  addedProductIds,
  removedProductIds,
  addedSupplierIds,
  removedSupplierIds,
  fetchWithCreds,
}: {
  accessToken: string;
  id: string;
  name?: string;
  addedProductIds?: string[];
  removedProductIds?: string[];
  addedSupplierIds?: string[];
  removedSupplierIds?: string[];
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi<DetailedOrder>> => {
  const url = `/api/procurement/order`;
  return fetchWithCreds<DetailedOrder>({
    accessToken,
    path: url,
    method: 'PUT',
    body: {
      id,
      name,
      addedProductIds,
      removedProductIds,
      addedSupplierIds,
      removedSupplierIds,
    },
  });
};

export const createProcurementProduct = async ({
  accessToken,
  fetchWithCreds,
  name,
}: {
  accessToken: string;
  name: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi<ProcurementProduct>> => {
  return fetchWithCreds<ProcurementProduct>({
    accessToken,
    path: '/api/procurement/product',
    method: 'POST',
    body: {
      name,
    },
  });
};

export const createSupplier = async ({
  accessToken,
  fetchWithCreds,
  name,
}: {
  accessToken: string;
  name: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi<ProcurementSupplier>> => {
  return fetchWithCreds<ProcurementSupplier>({
    accessToken,
    path: '/api/procurement/supplier',
    method: 'POST',
    body: {
      name,
    },
  });
};

export const createHistory = async ({
  accessToken,
  fetchWithCreds,
  name,
}: {
  accessToken: string;
  name: string;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi<ProcurementOrder>> => {
  return fetchWithCreds<ProcurementOrder>({
    accessToken,
    path: '/api/procurement/order',
    method: 'POST',
    body: {
      name,
    },
  });
};

export const createProductQuantity = async ({
  accessToken,
  orderId,
  productId,
  quantity,
  fetchWithCreds,
}: {
  accessToken: string;
  orderId: string;
  productId: string;
  quantity?: number;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi<ProcurementOrderProductQuantity>> => {
  return fetchWithCreds<ProcurementOrderProductQuantity>({
    accessToken,
    path: '/api/procurement/order/quantities',
    method: 'POST',
    body: {
      orderId,
      productId,
      quantity,
    },
  });
};

export const editProductQuantity = async ({
  accessToken,
  orderId,
  productId,
  quantity,
  fetchWithCreds,
}: {
  accessToken: string;
  orderId: string;
  productId: string;
  quantity: number;
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi<ProcurementOrderProductQuantity>> => {
  return fetchWithCreds<ProcurementOrderProductQuantity>({
    accessToken,
    path: '/api/procurement/order/quantities',
    method: 'PUT',
    body: {
      orderId,
      productId,
      quantity,
    },
  });
};

export const editProductPrices = async ({
  accessToken,
  updatedPrices,
  fetchWithCreds,
}: {
  accessToken: string;
  updatedPrices: Partial<ProcurementSupplierProductPrice>[];
  fetchWithCreds: FetchWithCredsType;
}): Promise<ResponseApi> => {
  return fetchWithCreds<ProcurementSupplierProductPrice[]>({
    accessToken,
    path: '/api/procurement/order/prices',
    method: 'PUT',
    body: updatedPrices,
  });
};
