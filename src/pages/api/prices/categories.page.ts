import dbClient from '@/lib/dbClient';
import { whereActiveProduct } from '@/lib/prismaActiveScope';
import addCors from '@/pages/api/utils/addCors';
import { squareBracketRegex } from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { parseVariantTag } from '@/pages/product/utils';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/prices/categories.page.ts';

// Returns a map of priceId -> categoryIds of the products that reference it.
// Prices carry no category link; the relationship is implicit in each product's
// `price` ([priceId]) and its `tags` (each "spec [priceId]{colorId}"). The
// update-prices page uses this to filter prices by category. Mirrors the
// derive-from-products approach in api/product/filters.page.ts.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);
  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  try {
    const products = await dbClient.product.findMany({
      where: whereActiveProduct,
      select: { price: true, tags: true, categoryId: true },
    });

    const sets: Record<string, Set<string>> = {};
    const add = (priceId: string, categoryId: string) => {
      (sets[priceId] ??= new Set()).add(categoryId);
    };

    products.forEach(({ price, tags, categoryId }) => {
      const priceMatch = price?.match(squareBracketRegex);
      if (priceMatch) add(priceMatch[1], categoryId);
      tags.forEach((tag) => {
        const { priceId } = parseVariantTag(tag);
        if (priceId) add(priceId, categoryId);
      });
    });

    const map: Record<string, string[]> = {};
    Object.keys(sets).forEach((priceId) => {
      map[priceId] = [...sets[priceId]];
    });

    return res.status(200).json({ success: true, data: map });
  } catch (error) {
    console.error(filepath, error);
    return res
      .status(500)
      .json({ success: false, message: (error as Error).message });
  }
}
