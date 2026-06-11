import dbClient from '@/lib/dbClient';
import { whereActiveProduct } from '@/lib/prismaActiveScope';
import addCors from '@/pages/api/utils/addCors';
import { ResponseApi } from '@/pages/lib/types';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/product/filters.page.ts';

// Returns the distinct color filter values (referenced colorIds) currently in
// use across products. Resolve names/hex client-side via /api/colors.
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
      select: { colors: true },
    });

    const colors = new Set<string>();
    products.forEach((p) => {
      p.colors.forEach((c) => colors.add(c));
    });

    return res.status(200).json({
      success: true,
      data: { colors: [...colors] },
    });
  } catch (error) {
    console.error(filepath, error);
    return res
      .status(500)
      .json({ success: false, message: (error as Error).message });
  }
}
