import { fetchWithCreds } from '@/pages/lib/fetch';
import { ResponseApi } from '@/pages/lib/types';
import { DetailedOrder } from '@/pages/procurement/lib/types';
import {
  ProcurementOrder,
  ProcurementOrderProductQuantity,
  ProcurementProduct,
  ProcurementSupplier,
  ProcurementSupplierProductPrice,
} from '@prisma/client';

export const fetchSuppliers = async (
  accessToken: string,
): Promise<ResponseApi<ProcurementSupplier[]>> => {
  return fetchWithCreds<ProcurementSupplier[]>(
    accessToken,
    '/api/procurement/supplier',
    'GET',
  );
};

export const deleteSupplier = async (
  accessToken: string,
  id: string,
): Promise<ResponseApi<ProcurementSupplier>> => {
  return fetchWithCreds<ProcurementSupplier>(
    accessToken,
    '/api/procurement/supplier',
    'DELETE',
    { id },
  );
};

export const deleteProductQuantity = async ({
  accessToken,
  orderId,
  productId,
}: {
  accessToken: string;
  orderId: string;
  productId: string;
}): Promise<ResponseApi<ProcurementOrderProductQuantity>> => {
  return fetchWithCreds<ProcurementOrderProductQuantity>(
    accessToken,
    '/api/procurement/order/quantities',
    'DELETE',
    { orderId, productId },
  );
};

export const deleteHistory = async (
  accessToken: string,
  id: string,
): Promise<ResponseApi<ProcurementSupplier>> => {
  return fetchWithCreds<ProcurementSupplier>(
    accessToken,
    '/api/procurement/order',
    'DELETE',
    { id },
  );
};

export const deleteProduct = async (
  accessToken: string,
  id: string,
): Promise<ResponseApi<ProcurementProduct>> => {
  return fetchWithCreds<ProcurementProduct>(
    accessToken,
    '/api/procurement/product',
    'DELETE',
    { id },
  );
};

export const getProcurementProducts = async (
  accessToken: string,
  searchKeyword?: string,
): Promise<ResponseApi<ProcurementProduct[]>> => {
  let url = '/api/procurement/product';
  if (searchKeyword) {
    url += `?searchKeyword=${searchKeyword}`;
  }
  return fetchWithCreds<ProcurementProduct[]>(accessToken, url, 'GET');
};

export const getSuppliers = async (
  accessToken: string,
  searchKeyword?: string,
): Promise<ResponseApi<ProcurementSupplier[]>> => {
  let url = '/api/procurement/supplier';
  if (searchKeyword) {
    url += `?searchKeyword=${searchKeyword}`;
  }
  return fetchWithCreds<ProcurementSupplier[]>(accessToken, url, 'GET');
};

export const getHistoryList = async (
  accessToken: string,
): Promise<ResponseApi<ProcurementOrder[]>> => {
  const url = '/api/procurement/order';
  return fetchWithCreds<ProcurementOrder[]>(accessToken, url, 'GET');
};

export const getHistory = async (
  accessToken: string,
  id: string,
): Promise<ResponseApi<DetailedOrder>> => {
  const url = `/api/procurement/order?id=${id}`;
  return fetchWithCreds<DetailedOrder>(accessToken, url, 'GET');
};

export const editHistory = async ({
  accessToken,
  id,
  name,
  addedProductIds,
  removedProductIds,
  addedSupplierIds,
  removedSupplierIds,
}: {
  accessToken: string;
  id: string;
  name?: string;
  addedProductIds?: string[];
  removedProductIds?: string[];
  addedSupplierIds?: string[];
  removedSupplierIds?: string[];
}): Promise<ResponseApi<DetailedOrder>> => {
  const url = `/api/procurement/order`;
  return fetchWithCreds<DetailedOrder>(accessToken, url, 'PUT', {
    id,
    name,
    addedProductIds,
    removedProductIds,
    addedSupplierIds,
    removedSupplierIds,
  });
};

export const createProcurementProduct = async (
  accessToken: string,
  name: string,
): Promise<ResponseApi<ProcurementProduct>> => {
  return fetchWithCreds<ProcurementProduct>(
    accessToken,
    '/api/procurement/product',
    'POST',
    {
      name,
    },
  );
};

export const createSupplier = async (
  accessToken: string,
  name: string,
): Promise<ResponseApi<ProcurementSupplier>> => {
  return fetchWithCreds<ProcurementSupplier>(
    accessToken,
    '/api/procurement/supplier',
    'POST',
    {
      name,
    },
  );
};

export const createHistory = async (
  accessToken: string,
  name: string,
): Promise<ResponseApi<ProcurementOrder>> => {
  return fetchWithCreds<ProcurementOrder>(
    accessToken,
    '/api/procurement/order',
    'POST',
    {
      name,
    },
  );
};

export const createProductQuantity = async ({
  accessToken,
  orderId,
  productId,
  quantity,
}: {
  accessToken: string;
  orderId: string;
  productId: string;
  quantity: number;
}): Promise<ResponseApi<ProcurementOrderProductQuantity>> => {
  return fetchWithCreds<ProcurementOrderProductQuantity>(
    accessToken,
    '/api/procurement/order/quantities',
    'POST',
    {
      orderId,
      productId,
      quantity,
    },
  );
};

export const editProductQuantity = async ({
  accessToken,
  orderId,
  productId,
  quantity,
}: {
  accessToken: string;
  orderId: string;
  productId: string;
  quantity: number;
}): Promise<ResponseApi<ProcurementOrderProductQuantity>> => {
  return fetchWithCreds<ProcurementOrderProductQuantity>(
    accessToken,
    '/api/procurement/order/quantities',
    'PUT',
    {
      orderId,
      productId,
      quantity,
    },
  );
};

export const editProductPrices = async ({
  accessToken,
  updatedPrices,
}: {
  accessToken: string;
  updatedPrices: Partial<ProcurementSupplierProductPrice>[];
}): Promise<ResponseApi> => {
  return fetchWithCreds<ProcurementSupplierProductPrice[]>(
    accessToken,
    '/api/procurement/order/prices',
    'PUT',
    updatedPrices,
  );
};
