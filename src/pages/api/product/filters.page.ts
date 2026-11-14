import dbClient from '@/lib/dbClient';
import {
  buildProductWhere,
  ProductFilterQuery,
} from '@/pages/api/product/productWhere';
import addCors from '@/pages/api/utils/addCors';
import { hasStaffBearer } from '@/pages/api/utils/staffAuth';
import type { Color, Prisma } from '@prisma/client';
import { ColorFamily, groupColorsByFamily } from '@/pages/lib/colorFamilies';
import {
  FilterDimension,
  FilterRelaxations,
} from '@/pages/lib/filterRelaxations';
import { priceFacet } from '@/pages/lib/priceFacet';
import { ResponseApi } from '@/pages/lib/types';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/product/filters.page.ts';

// Returns, for a storefront query: how many products it matches, how many each
// brand and colour family would show (options that lead nowhere are absent),
// the price range with quick brackets, and, when nothing matches, what
// dropping each filter would bring back. Each dimension is
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
    // Staff count products without images too, matching the grid they see.
    const options = { includeImageless: await hasStaffBearer(req) };
    const [where, brandWhere, colorWhere, priceWhere, stockWhere] =
      await Promise.all([
        buildProductWhere(query, options),
        buildProductWhere({ ...query, brandIds: undefined }, options),
        buildProductWhere(
          { ...query, colors: undefined, colorIds: undefined },
          options,
        ),
        buildProductWhere(
          { ...query, minPrice: undefined, maxPrice: undefined },
          options,
        ),
        buildProductWhere({ ...query, inStock: undefined }, options),
      ]);
    const count = (scope: Prisma.ProductWhereInput | null) =>
      scope ? dbClient.product.count({ where: scope }) : Promise.resolve(0);

    const [total, brandRows, products, priced] = await Promise.all([
      count(where),
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

    // Only an empty result pays for these: what dropping each active filter
    // would bring back.
    const relaxations: FilterRelaxations = {};
    if (total === 0) {
      const active: [
        FilterDimension,
        boolean,
        Prisma.ProductWhereInput | null,
      ][] = [
        ['brands', query.brandIds != null, brandWhere],
        ['colors', query.colors != null || query.colorIds != null, colorWhere],
        ['inStock', query.inStock === '1', stockWhere],
      ];
      await Promise.all(
        active
          .filter(([, isActive]) => isActive)
          .map(async ([dimension, , scope]) => {
            relaxations[dimension] = await count(scope);
          }),
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        total,
        relaxations,
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
