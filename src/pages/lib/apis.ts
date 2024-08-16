import BASE_URL from '@/lib/ApiEndpoints';
import { ResponseApi } from '@/pages/lib/types';
import { Product } from '@prisma/client';

const squareBracketRegex = /\[([^\]]+)\]/;

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

  const processedData = await Promise.all(
    data.map(async (product) => {
      let newProduct = product;
      const priceMatch = product.price?.match(squareBracketRegex);
      if (priceMatch != null) {
        const nameTag = priceMatch[1];
        const res = await (
          await fetch(`${BASE_URL}/api/prices?productName=${nameTag}`)
        ).json();
        if (res.success && res.data != null) {
          newProduct = { ...product, price: res.data.price };
        }
      }

      await Promise.all(
        product.tags.map(async (tag) => {
          const tagMatch = tag.match(squareBracketRegex);
          if (tagMatch != null) {
            const nameTag = tagMatch[1];
            const res = await (
              await fetch(`${BASE_URL}/api/prices?productName=${nameTag}`)
            ).json();
            if (res.success && res.data != null) {
              newProduct = {
                ...newProduct,
                tags: newProduct.tags.map((t) =>
                  t === tag ? tag.replace(`[${nameTag}]`, res.data.price) : t,
                ),
              };
            }
          }
        }),
      );
      return newProduct;
    }),
  );

  return processedData;
};
