import BASE_URL from '@/lib/ApiEndpoints';
import { ResponseApi } from '@/pages/lib/types';
import { Prices, Product } from '@prisma/client';

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

export const fetchPrices = async (searchKeyword: string): Promise<Prices[]> => {
  const url = `${BASE_URL}/api/prices?searchKeyword=${searchKeyword}`;
  const pricesResponse: ResponseApi<Prices[]> = await (await fetch(url)).json();

  if (!pricesResponse.success || pricesResponse.data == null) {
    throw new Error(pricesResponse.message);
  }

  return pricesResponse.data;
};
