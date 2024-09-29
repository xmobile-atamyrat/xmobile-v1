import BASE_URL from '@/lib/ApiEndpoints';
import { ResponseApi } from '@/pages/lib/types';
import { Prices, Product } from '@prisma/client';

const squareBracketRegex = /\[([^\]]+)\]/;

export const computeProductPrice = async (
  product: Product,
): Promise<Product> => {
  const processedProduct = { ...product, price: '' };
  const priceMatch = product.price?.match(squareBracketRegex);
  if (priceMatch == null) return processedProduct;

  const res: ResponseApi<Prices> = await (
    await fetch(`${BASE_URL}/api/prices?id=${priceMatch[1]}`)
  ).json();
  if (!res.success || res.data == null) return processedProduct;

  processedProduct.price = res.data.priceInTmt;

  if (product.tags.length > 0) {
    processedProduct.tags = await Promise.all(
      processedProduct.tags.map(async (tag) => {
        const tagMatch = tag.match(squareBracketRegex);
        if (tagMatch != null) {
          const idTag = tagMatch[1];
          const tagRes: ResponseApi<Prices> = await (
            await fetch(`${BASE_URL}/api/prices?id=${idTag}`)
          ).json();
          if (tagRes.success && tagRes.data != null) {
            return tag.replace(`[${idTag}]`, tagRes.data.priceInTmt);
          }
        }
        return tag;
      }),
    );
  }

  return processedProduct;
};
