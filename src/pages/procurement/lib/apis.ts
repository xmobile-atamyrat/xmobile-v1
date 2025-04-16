import { fetchWithCreds } from '@/pages/lib/fetch';
import { ResponseApi } from '@/pages/lib/types';
import { ProcurementProduct, Supplier } from '@prisma/client';

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
