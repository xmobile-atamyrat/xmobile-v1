import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { Prisma, ProcurementOrder } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/procurement/order/index.page.ts';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  addCors(res);
  const { userId, method } = req as AuthenticatedRequest;
  const user = await dbClient.user.findUnique({
    where: { id: userId },
  });
  if (!user || user.grade !== 'SUPERUSER') {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    if (method === 'GET') {
      const id = req.query.id as string;
      if (id) {
        const history = await dbClient.procurementOrder.findUnique({
          where: { id },
          include: {
            suppliers: true,
            products: true,
            prices: true,
            productQuantities: true,
          },
        });
        return res.status(200).json({ success: true, data: history });
      }
      const allHistory = await dbClient.procurementOrder.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });
      return res.status(200).json({ success: true, data: allHistory });
    }
    if (method === 'POST') {
      const { name }: ProcurementOrder = req.body;
      const history = await dbClient.procurementOrder.create({
        data: {
          name,
        },
      });
      return res.status(200).json({ success: true, data: history });
    }
    if (method === 'DELETE') {
      const id = req.body.id as string;
      const history = await dbClient.procurementOrder.delete({
        where: { id },
      });
      return res.status(200).json({ success: true, data: history });
    }
    if (method === 'PUT') {
      const {
        id,
        name,
        addedProductIds,
        addedSupplierIds,
        removedProductIds,
        removedSupplierIds,
      }: ProcurementOrder & {
        addedSupplierIds?: string[];
        addedProductIds?: string[];
        removedSupplierIds?: string[];
        removedProductIds?: string[];
      } = req.body;

      const updateData: Partial<Prisma.ProcurementOrderUpdateInput> = {};
      if (name) updateData.name = name;
      updateData.suppliers = {
        connect: addedSupplierIds?.map((addedSuppliedId) => ({
          id: addedSuppliedId,
        })),
        disconnect: removedSupplierIds?.map((removedSuppliedId) => ({
          id: removedSuppliedId,
        })),
      };
      updateData.products = {
        connect: addedProductIds?.map((addedProductId) => ({
          id: addedProductId,
        })),
        disconnect: removedProductIds?.map((removedProductId) => ({
          id: removedProductId,
        })),
      };

      const history = await dbClient.procurementOrder.update({
        where: { id },
        data: updateData,
      });

      return res.status(200).json({ success: true, data: history });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message,
    });
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}

export default withAuth(handler);
