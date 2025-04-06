import { fetchWithCreds } from '@/pages/lib/fetch';
import { ResponseApi } from '@/pages/lib/types';
import { Supplier } from '@prisma/client';

export const fetchSuppliers = async (
  accessToken: string,
): Promise<ResponseApi<Supplier[]>> => {
  return fetchWithCreds<Supplier[]>(
    accessToken,
    '/api/procurement/supplier',
    'GET',
  );
};
