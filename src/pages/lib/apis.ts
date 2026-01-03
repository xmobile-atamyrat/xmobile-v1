import BASE_URL from '@/lib/ApiEndpoints';
import { ResponseApi, BrandProps } from '@/pages/lib/types';
import { Product } from '@prisma/client';

export const fetchProducts = async ({
  categoryId,
  searchKeyword,
  productId,
  page,
}: {
  categoryId?: string;
  searchKeyword?: string;
  productId?: string;
  page?: number;
}): Promise<Product[]> => {
  if (categoryId == null && searchKeyword == null && productId == null)
    return [];

  let url = `${BASE_URL}/api/product?page=${page || 1}`;
  if (categoryId) {
    url += `&categoryId=${categoryId}`;
    if (searchKeyword) {
      url += `&searchKeyword=${searchKeyword}`;
    }
  } else if (productId) {
    url += `&productId=${productId}`;
  } else {
    console.error('Neither categoryId nor productId is provided');
    return [];
  }

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
