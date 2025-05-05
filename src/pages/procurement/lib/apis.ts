import { fetchWithCreds } from '@/pages/lib/fetch';
import { ResponseApi } from '@/pages/lib/types';
import { DetailedHistory } from '@/pages/procurement/lib/types';
import {
  ProcurementOrder,
  ProcurementProduct,
  ProcurementSupplier,
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

export const deleteHistory = async (
  accessToken: string,
  id: string,
): Promise<ResponseApi<ProcurementSupplier>> => {
  return fetchWithCreds<ProcurementSupplier>(
    accessToken,
    '/api/procurement/calculation/history',
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
  const url = '/api/procurement/calculation/history';
  return fetchWithCreds<ProcurementOrder[]>(accessToken, url, 'GET');
};

export const getHistory = async (
  accessToken: string,
  id: string,
): Promise<ResponseApi<DetailedHistory>> => {
  const url = `/api/procurement/calculation/history?id=${id}`;
  return fetchWithCreds<DetailedHistory>(accessToken, url, 'GET');
};

export const editHistory = async ({
  accessToken,
  id,
  name,
  prices,
  quantities,
  addedProductIds,
  removedProductIds,
  addedSupplierIds,
  removedSupplierIds,
}: {
  accessToken: string;
  id: string;
  name?: string;
  prices?: (number | null)[][];
  quantities?: (number | null)[];
  addedProductIds?: string[];
  removedProductIds?: string[];
  addedSupplierIds?: string[];
  removedSupplierIds?: string[];
}): Promise<ResponseApi<DetailedHistory>> => {
  const url = `/api/procurement/calculation/history`;
  return fetchWithCreds<DetailedHistory>(accessToken, url, 'PUT', {
    id,
    name,
    prices,
    quantities,
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
    '/api/procurement/calculation/history',
    'POST',
    {
      name,
    },
  );
};
