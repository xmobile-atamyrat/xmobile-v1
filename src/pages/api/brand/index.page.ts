import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { BrandProps, ResponseApi } from '@/pages/lib/types';
import { UserRole } from '@prisma/client';
import { NextApiResponse } from 'next';

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

export default withAuth(handler);
