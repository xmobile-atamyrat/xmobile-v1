import dbClient from '@/lib/dbClient';
import {
  buildProductWhere,
  ProductFilterQuery,
} from '@/pages/api/product/productWhere';
import addCors from '@/pages/api/utils/addCors';
import { groupColorsByFamily } from '@/pages/lib/colorFamilies';
import { ResponseApi } from '@/pages/lib/types';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/product/filters.page.ts';

// Returns the filter options that still lead somewhere for a storefront query.
// Each dimension is scoped by every filter except its own, so ticking Apple
// narrows the colours but keeps Samsung on offer as a second brand.
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
    const query = req.query as ProductFilterQuery;
    const [brandWhere, colorWhere] = await Promise.all([
      buildProductWhere({ ...query, brandIds: undefined }),
      buildProductWhere({ ...query, colors: undefined, colorIds: undefined }),
    ]);

    const [brandRows, colors] = await Promise.all([
      brandWhere
        ? dbClient.product.findMany({
            where: { ...brandWhere, brandId: { not: null } },
            select: { brandId: true },
            distinct: ['brandId'],
          })
        : [],
      colorWhere
        ? dbClient.color.findMany({
            where: { products: { some: colorWhere } },
            select: { id: true, name: true, hex: true },
          })
        : [],
    ]);

    return res.status(200).json({
      success: true,
      data: {
        colors: colors.map((c) => c.id),
        colorFamilies: groupColorsByFamily(colors).map((g) => g.family),
        brandIds: brandRows.map((row) => row.brandId),
      },
    });
  } catch (error) {
    console.error(filepath, error);
    return res
      .status(500)
      .json({ success: false, message: (error as Error).message });
  }
}
