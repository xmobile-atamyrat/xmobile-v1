import BASE_URL from '@/lib/ApiEndpoints';
import { ResponseApi } from '@/pages/lib/types';
import { Product } from '@prisma/client';

export const fetchProductsEditPrices = async ({
  categoryId,
  searchKeyword,
}: {
  categoryId?: string;
  searchKeyword?: string;
}): Promise<Product[]> => {
  if (categoryId == null && searchKeyword == null) return [];

  let url = `${BASE_URL}/api/product`;
  if (categoryId) {
    url += `?categoryId=${categoryId}`;
  } else if (searchKeyword) {
    url += `?searchKeyword=${searchKeyword}`;
  }

  const { success, data, message }: ResponseApi<Product[]> = await (
    await fetch(url)
  ).json();
  if (!success || data == null) {
    throw new Error(message);
  }

  return data;
};
