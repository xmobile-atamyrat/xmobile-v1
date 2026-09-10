import dbClient from '@/lib/dbClient';
import { revalidateInBackground } from '@/lib/revalidate';
import { productRevalidationPaths } from '@/lib/revalidateTargets';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { BrandProps, ResponseApi } from '@/pages/lib/types';
import { UserRole } from '@prisma/client';
import { NextApiResponse } from 'next';

/**
 * A brand has no page of its own — its name is baked into each product's
 * `<title>` and JSON-LD — so a rename or delete has to reach the product pages
 * to show up at all. Brands with more than ~25 products overshoot the batch cap
 * and fall back to the TTL, which renames are rare enough to tolerate.
 */
async function brandProductPaths(brandId: string): Promise<string[]> {
  const products = await dbClient.product.findMany({
    where: { brandId, deletedAt: null },
    select: { id: true },
  });
  return productRevalidationPaths(products.map((product) => product.id));
}

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ResponseApi<BrandProps[] | any>>,
) {
  addCors(res);
  try {
    const { method, body, query } = req;
    const { grade } = req;

    if (method === 'GET') {
      const brands = await dbClient.brand.findMany();

      return res.status(200).json({ success: true, data: brands });
    }

    if (grade !== UserRole.ADMIN && grade !== UserRole.SUPERUSER) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (method === 'POST') {
      const { name } = body;
      if (!name) {
        return res
          .status(400)
          .json({ success: false, message: 'Name is required' });
      }

      const existing = await dbClient.brand.findUnique({ where: { name } });
      if (existing) {
        return res
          .status(400)
          .json({ success: false, message: 'Brand already exists' });
      }

      const brand = await dbClient.brand.create({
        data: { name },
      });

      return res.status(201).json({ success: true, data: brand });
    }

    if (method === 'PUT') {
      const { id, name } = body;
      if (!id || !name) {
        return res
          .status(400)
          .json({ success: false, message: 'ID and Name are required' });
      }

      const brand = await dbClient.brand.update({
        where: { id },
        data: { name },
      });

      revalidateInBackground(res, await brandProductPaths(id));

      return res.status(200).json({ success: true, data: brand });
    }

    if (method === 'DELETE') {
      const { id } = query;
      if (!id || typeof id !== 'string') {
        return res
          .status(400)
          .json({ success: false, message: 'ID is required' });
      }

      // Collected before the delete: the products' `brandId` is about to be
      // cleared, so afterwards there is nothing left to look them up by.
      const paths = await brandProductPaths(id);

      await dbClient.brand.delete({
        where: { id },
      });

      revalidateInBackground(res, paths);

      return res.status(200).json({ success: true, message: 'Deleted' });
    }

    return res
      .status(405)
      .json({ success: false, message: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Brand API Error:', error);
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Internal Error' });
  }
}

export default withAuth(handler);
