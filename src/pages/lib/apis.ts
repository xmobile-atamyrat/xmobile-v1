import BASE_URL from '@/lib/ApiEndpoints';
import { ResponseApi } from '@/pages/lib/types';
import { Product } from '@prisma/client';

export const fetchProducts = async ({
  categoryId,
  searchKeyword,
  productId,
}: {
  categoryId?: string;
  searchKeyword?: string;
  productId?: string;
}): Promise<Product[]> => {
  if (categoryId == null && searchKeyword == null && productId == null)
    return [];

  let url = `${BASE_URL}/api/product`;
  if (categoryId) {
    url += `?categoryId=${categoryId}`;
  } else if (searchKeyword) {
    url += `?searchKeyword=${searchKeyword}`;
  } else if (productId) {
    url += `?productId=${productId}`;
  }

  const { success, data, message }: ResponseApi<Product[]> = await (
    await fetch(url)
  ).json();
  if (!success || data == null) {
    throw new Error(message);
  }

  return Array.isArray(data) ? data : [data];
};
