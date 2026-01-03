import BASE_URL from '@/lib/ApiEndpoints';
import { ResponseApi, BrandProps } from '@/pages/lib/types';
import { Product } from '@prisma/client';

export const fetchProducts = async ({
  categoryIds,
  brandIds,
  minPrice,
  maxPrice,
  sortBy,
  searchKeyword,
  productId,
  page,
}: {
  categoryIds?: string[];
  brandIds?: string[];
  minPrice?: string;
  maxPrice?: string;
  sortBy?: string;
  searchKeyword?: string;
  productId?: string;
  page?: number;
}): Promise<Product[]> => {
  // Allow fetching if ANY filter is present (removed restrict check)

  let url = `${BASE_URL}/api/product?page=${page || 1}`;

  // Helper to append params
  const appendParam = (key: string, val: any) => {
    if (val) url += `&${key}=${val}`;
  };

  if (categoryIds && categoryIds.length > 0) {
    categoryIds.forEach((cid) => appendParam('categoryId', cid));
  }

  appendParam('searchKeyword', searchKeyword);
  appendParam('productId', productId);

  if (brandIds && brandIds.length > 0) {
    brandIds.forEach((bid) => appendParam('brandIds', bid));
  }

  appendParam('minPrice', minPrice);
  appendParam('maxPrice', maxPrice);
  appendParam('sortBy', sortBy);

  const { success, data, message }: ResponseApi<Product[]> = await (
    await fetch(url)
  ).json();
  if (!success || data == null) {
    throw new Error(message);
  }
  return Array.isArray(data) ? data : [data];
};

export const fetchNewProducts = async ({
  searchKeyword,
  page,
}: {
  searchKeyword?: string;
  page?: number;
}): Promise<Product[]> => {
  let url = `${BASE_URL}/api/product/new?page=${page || 1}`;
  if (searchKeyword) {
    url += `&searchKeyword=${encodeURIComponent(searchKeyword)}`;
  }

  const { success, data, message }: ResponseApi<Product[]> = await (
    await fetch(url)
  ).json();
  if (!success || data == null) {
    throw new Error(message);
  }
  return Array.isArray(data) ? data : [];
};

export const fetchBrands = async (): Promise<BrandProps[]> => {
  const { success, data, message }: ResponseApi<any[]> = await (
    await fetch(`${BASE_URL}/api/brand`)
  ).json();

  if (!success || data == null) {
    console.error('Failed to fetch brands:', message);
    return [];
  }
  return data;
};
