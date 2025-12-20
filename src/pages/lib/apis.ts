import BASE_URL from '@/lib/ApiEndpoints';
import { ResponseApi } from '@/pages/lib/types';
import { Product } from '@prisma/client';

export const fetchProducts = async ({
  categoryId,
  searchKeyword,
  productId,
  page,
  all,
}: {
  categoryId?: string;
  searchKeyword?: string;
  productId?: string;
  page?: number;
  all?: boolean;
}): Promise<Product[]> => {
  if (categoryId == null && searchKeyword == null && productId == null)
    return [];

  let url = `${BASE_URL}/api/product?page=${page || 1}`;
  if (all) {
    url += `&all=true`;
  } else if (categoryId) {
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
