import dbClient from '@/lib/dbClient';
import {
  buildProductWhere,
  ProductFilterQuery,
} from '@/pages/api/product/productWhere';
import addCors from '@/pages/api/utils/addCors';
import type { Color } from '@prisma/client';
import { ColorFamily, groupColorsByFamily } from '@/pages/lib/colorFamilies';
import { priceFacet } from '@/pages/lib/priceFacet';
import { ResponseApi } from '@/pages/lib/types';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/product/filters.page.ts';

// Returns how many products each brand and colour family would show for a
// storefront query (options that lead nowhere are absent), and the price
// range with quick brackets. Each dimension is
// scoped by every filter except its own, so ticking Apple narrows the colours
// but keeps Samsung on offer (with its own count) as a second brand.
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
    const [brandWhere, colorWhere, priceWhere] = await Promise.all([
      buildProductWhere({ ...query, brandIds: undefined }),
      buildProductWhere({ ...query, colors: undefined, colorIds: undefined }),
      buildProductWhere({ ...query, minPrice: undefined, maxPrice: undefined }),
    ]);

    const [brandRows, products, priced] = await Promise.all([
      brandWhere
        ? dbClient.product.groupBy({
            by: ['brandId'],
            where: { ...brandWhere, brandId: { not: null } },
            // `true` rather than `{ _all: true }` so the row carries a number.
            _count: true,
          })
        : [],
      colorWhere
        ? dbClient.product.findMany({
            where: { ...colorWhere, colors: { some: {} } },
            select: { colors: { select: { id: true, name: true, hex: true } } },
          })
        : [],
      priceWhere
        ? dbClient.product.findMany({
            where: { ...priceWhere, cachedPrice: { gt: 0 } },
            select: { cachedPrice: true },
          })
        : [],
    ]);

    const brandCounts: Record<string, number> = {};
    brandRows.forEach((row) => {
      // _count is Prisma's own groupBy result shape, not our naming.
      // eslint-disable-next-line no-underscore-dangle
      if (row.brandId != null) brandCounts[row.brandId] = row._count;
    });

    // Products, not colour rows: a phone in two black shades counts once.
    const colorCounts: Partial<Record<ColorFamily, number>> = {};
    const colorIds = new Set<string>();
    products.forEach(
      ({ colors }: { colors: Pick<Color, 'id' | 'name' | 'hex'>[] }) => {
        colors.forEach(({ id }) => colorIds.add(id));
        groupColorsByFamily(colors).forEach(({ family }) => {
          colorCounts[family] = (colorCounts[family] ?? 0) + 1;
        });
      },
    );

    return res.status(200).json({
      success: true,
      data: {
        colors: [...colorIds],
        brandCounts,
        colorCounts,
        price: priceFacet(
          priced.map(({ cachedPrice }: { cachedPrice: number | null }) =>
            Number(cachedPrice),
          ),
        ),
      },
    });
  } catch (error) {
    console.error(filepath, error);
    return res
      .status(500)
      .json({ success: false, message: (error as Error).message });
  }
}
