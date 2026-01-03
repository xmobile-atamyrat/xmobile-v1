import dbClient from '@/lib/dbClient';
import { BrandProps, ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi<BrandProps[] | any>>,
) {
  try {
    const { method, body, query } = req;

    if (method === 'GET') {
      const brands = await dbClient.brand.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { products: true },
          },
        },
      });

      // Flatten the _count to make it easier for frontend
      const data: BrandProps[] = brands.map((b) => ({
        id: b.id,
        name: b.name,
        // eslint-disable-next-line no-underscore-dangle
        productCount: b._count.products,
        createdAt: b.createdAt,
      }));

      return res.status(200).json({ success: true, data });
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

      return res.status(200).json({ success: true, data: brand });
    }

    if (method === 'DELETE') {
      const { id } = query;
      if (!id || typeof id !== 'string') {
        return res
          .status(400)
          .json({ success: false, message: 'ID is required' });
      }

      await dbClient.brand.delete({
        where: { id },
      });

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
