import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/procurement/suppliers.page.ts';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  addCors(res);
  const { userId, method } = req as AuthenticatedRequest;
  const user = await dbClient.user.findUnique({
    where: { id: userId },
  });
  if (!user || user.grade !== 'SUPERUSER') {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (method === 'GET') {
    try {
      const { searchKeyword } = req.query;
      if (searchKeyword) {
        const suppliers = await dbClient.supplier.findMany({
          where: {
            name: {
              contains: searchKeyword as string,
              mode: 'insensitive',
            },
          },
        });
        return res.status(200).json({ success: true, data: suppliers });
      }
      const suppliers = await dbClient.supplier.findMany();
      return res.status(200).json({ success: true, data: suppliers });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  } else if (method === 'POST') {
    try {
      const { name, description } = req.body;
      const supplier = await dbClient.supplier.create({
        data: {
          name,
          description,
        },
      });
      return res.status(200).json({ success: true, data: supplier });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  } else if (method === 'PUT') {
    try {
      const { id, name, description } = req.body;
      const supplier = await dbClient.supplier.update({
        where: { id },
        data: {
          name,
          description,
        },
      });
      return res.status(200).json({ success: true, data: supplier });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  } else if (method === 'DELETE') {
    try {
      const { id } = req.body;
      const supplier = await dbClient.supplier.delete({
        where: { id },
      });
      return res.status(200).json({ success: true, data: supplier });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}

export default withAuth(handler);
