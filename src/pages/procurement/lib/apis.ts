import { fetchWithCreds } from '@/pages/lib/fetch';
import { ResponseApi } from '@/pages/lib/types';
import { DetailedHistory } from '@/pages/procurement/lib/types';
import {
  CalculationHistory,
  ProcurementProduct,
  Supplier,
} from '@prisma/client';

export const fetchSuppliers = async (
  accessToken: string,
): Promise<ResponseApi<Supplier[]>> => {
  return fetchWithCreds<Supplier[]>(
    accessToken,
    '/api/procurement/supplier',
    'GET',
  );
};

export const deleteSupplier = async (
  accessToken: string,
  id: string,
): Promise<ResponseApi<Supplier>> => {
  return fetchWithCreds<Supplier>(
    accessToken,
    '/api/procurement/supplier',
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
): Promise<ResponseApi<Supplier[]>> => {
  let url = '/api/procurement/supplier';
  if (searchKeyword) {
    url += `?searchKeyword=${searchKeyword}`;
  }
  return fetchWithCreds<Supplier[]>(accessToken, url, 'GET');
};

export const getHistoryList = async (
  accessToken: string,
): Promise<ResponseApi<CalculationHistory[]>> => {
  const url = '/api/procurement/calculation/history';
  return fetchWithCreds<CalculationHistory[]>(accessToken, url, 'GET');
};

export const getHistory = async (
  accessToken: string,
  id: string,
): Promise<ResponseApi<DetailedHistory>> => {
  const url = `/api/procurement/calculation/history?id=${id}`;
  return fetchWithCreds<DetailedHistory>(accessToken, url, 'GET');
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
): Promise<ResponseApi<Supplier>> => {
  return fetchWithCreds<Supplier>(
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
  supplierIds: string[],
  productIds: string[],
): Promise<ResponseApi<CalculationHistory>> => {
  return fetchWithCreds<CalculationHistory>(
    accessToken,
    '/api/procurement/calculation/history',
    'POST',
    {
      name,
      supplierIds,
      productIds,
    },
  );
};
