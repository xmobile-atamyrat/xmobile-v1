import dbClient from '@/lib/dbClient';
import { whereActiveProduct } from '@/lib/prismaActiveScope';
import addCors from '@/pages/api/utils/addCors';
import { requireStaffBearerAuth } from '@/pages/api/utils/staffAuth';
import { ResponseApi } from '@/pages/lib/types';
import { Prisma } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/product/admin-list.page.ts';

export interface AdminProductListItem {
  id: string;
  name: string;
  categoryId: string;
  priceCount: number;
  isOutOfStock: boolean;
}

// A deliberately thin product list for admin pickers and the products overview
// table: id, localized name blob, category, and how many prices are connected.
// The main GET /api/product is paginated and resolves a price per row (an N+1),
// which makes it the wrong tool for "let me search every product by name".
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
  if (!(await requireStaffBearerAuth(req, res))) return undefined;

  try {
    const { searchKeyword, categoryId } = req.query;

    const where: Prisma.ProductWhereInput = { ...whereActiveProduct };
    if (searchKeyword != null && searchKeyword !== '') {
      where.name = {
        contains: searchKeyword as string,
        mode: 'insensitive',
      };
    }
    if (categoryId != null && categoryId !== '') {
      where.categoryId = categoryId as string;
    }

    const products = await dbClient.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        categoryId: true,
        isOutOfStock: true,
        _count: { select: { prices: true } },
      },
      // Deliberately not ordered by name: it is a localized JSON blob, so the
      // database would sort by whichever locale key sits first inside each
      // string. The overview table sorts by the rendered name client-side,
      // where the active locale is known; this just needs to be stable.
      orderBy: { createdAt: 'desc' },
    });

    const data: AdminProductListItem[] = products.map(
      ({ id, name, categoryId: catId, isOutOfStock, _count }) => ({
        id,
        name,
        categoryId: catId,
        priceCount: _count.prices,
        isOutOfStock,
      }),
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(filepath, error);
    return res
      .status(500)
      .json({ success: false, message: (error as Error).message });
  }
}
