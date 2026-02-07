import BASE_URL from '@/lib/ApiEndpoints';
import { BrandProps, ResponseApi } from '@/pages/lib/types';
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
  let url = `${BASE_URL}/api/product?page=${page || 1}`;

  // Helper to append params
  const appendParam = (key: string, val: any) => {
    if (val) url += `&${key}=${val}`;
  };

  if (brandIds && brandIds.length > 0) {
    brandIds.forEach((bid) => appendParam('brandIds', bid));
  }

  if (categoryIds && categoryIds.length > 0) {
    categoryIds.forEach((cid) => appendParam('categoryIds', cid));
  }

  appendParam('maxPrice', maxPrice);
  appendParam('minPrice', minPrice);
  appendParam('productId', productId);
  appendParam('searchKeyword', searchKeyword);
  appendParam('sortBy', sortBy);

  const { success, data, message }: ResponseApi<Product[]> = await (
    await fetch(url)
  ).json();
  if (!success || data == null) {
    throw new Error(message);
  }
  return Array.isArray(data) ? data : [data];
};

// todo: legacy func, fetchProducts applies default sortBy=newest parameter
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
