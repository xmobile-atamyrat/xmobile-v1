import dbClient from '@/lib/dbClient';
import { whereActiveProduct } from '@/lib/prismaActiveScope';
import addCors from '@/pages/api/utils/addCors';
import { ResponseApi } from '@/pages/lib/types';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/prices/categories.page.ts';

// Returns a map of priceId -> categoryIds of the products that own it, read
// from the Prices.productId relation. Kept as its own endpoint rather than
// folded into Prices.categoryId because the two are deliberately allowed to
// diverge — see the note on NO_CATEGORY_FILTER in src/pages/product/utils.ts.
//
// No in-repo caller left: the update-prices page now filters on the price's own
// category. Kept for the mobile clients, which still read it. Note it derives
// from Prices.productId, so it returns {} until the product-price backfill has
// been applied.
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
    const prices = await dbClient.prices.findMany({
      where: { product: whereActiveProduct },
      select: { id: true, product: { select: { categoryId: true } } },
    });

    // Each price has at most one owning product, so every entry holds exactly
    // one category id — the array shape is kept for the consumers that already
    // treat this as a list.
    const map: Record<string, string[]> = {};
    prices.forEach(({ id, product }) => {
      if (product != null) map[id] = [product.categoryId];
    });

    return res.status(200).json({ success: true, data: map });
  } catch (error) {
    console.error(filepath, error);
    return res
      .status(500)
      .json({ success: false, message: (error as Error).message });
  }
}
