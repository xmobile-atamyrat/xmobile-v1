import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ProcurementOrderProductQuantity } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/procurement/order/quantities.page.ts';

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
      const orderId = req.query.id as string;
      const productId = req.query.productId as string;
      if (productId) {
        const quantity =
          await dbClient.procurementOrderProductQuantity.findUnique({
            where: {
              orderId_productId: {
                orderId,
                productId,
              },
            },
          });
        return res.status(200).json({ success: true, data: quantity });
      }
      const allQuantities =
        await dbClient.procurementOrderProductQuantity.findMany({
          where: {
            orderId,
          },
        });
      return res.status(200).json({ success: true, data: allQuantities });
    } else if (method === 'POST') {
      const { orderId, productId, quantity }: ProcurementOrderProductQuantity =
        req.body;
      const existingQuantity =
        await dbClient.procurementOrderProductQuantity.findUnique({
          where: {
            orderId_productId: {
              orderId,
              productId,
            },
          },
        });
      if (existingQuantity) {
        return res.status(200).json({
          success: false,
          message: 'Quantity already exists',
        });
      }
      const newQuantity = await dbClient.procurementOrderProductQuantity.create(
        {
          data: {
            orderId,
            productId,
            quantity,
          },
        },
      );
      return res.status(200).json({ success: true, data: newQuantity });
    } else if (method === 'PUT') {
      const { orderId, productId, quantity }: ProcurementOrderProductQuantity =
        req.body;
      const updatedQuantity =
        await dbClient.procurementOrderProductQuantity.update({
          where: {
            orderId_productId: {
              orderId,
              productId,
            },
          },
          data: {
            quantity,
          },
        });
      return res.status(200).json({ success: true, data: updatedQuantity });
    } else if (method === 'DELETE') {
      const { orderId, productId }: ProcurementOrderProductQuantity = req.body;
      const deletedQuantity =
        await dbClient.procurementOrderProductQuantity.delete({
          where: {
            orderId_productId: {
              orderId,
              productId,
            },
          },
        });
      return res.status(200).json({ success: true, data: deletedQuantity });
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
