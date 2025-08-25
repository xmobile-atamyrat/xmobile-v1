import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ProcurementOrder } from '@prisma/client';
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
            suppliers: {
              orderBy: {
                createdAt: 'desc',
              },
              include: {
                supplier: true,
              },
            },
            products: {
              orderBy: {
                createdAt: 'desc',
              },
              include: {
                product: true,
              },
            },
            prices: true,
            productQuantities: true,
            dollarRate: true,
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
        currency,
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

      const order = await dbClient.procurementOrder.update({
        where: { id },
        data: {
          name,
          currency,
        },
      });

      // connect products to order
      if (addedProductIds) {
        await Promise.all(
          addedProductIds?.map((addedProductId) => {
            return dbClient.procurementOrderProduct.create({
              data: {
                orderId: id,
                productId: addedProductId,
              },
            });
          }),
        );
      }

      // connect suppliers to order
      if (addedSupplierIds) {
        await Promise.all(
          addedSupplierIds?.map((addedSupplierId) => {
            return dbClient.procurementOrderSupplier.create({
              data: {
                orderId: id,
                supplierId: addedSupplierId,
              },
            });
          }),
        );
      }

      // disconnect products from order
      if (removedProductIds) {
        await Promise.all(
          removedProductIds?.map((removedProductId) => {
            return dbClient.procurementOrderProduct.delete({
              where: {
                orderId_productId: {
                  orderId: id,
                  productId: removedProductId,
                },
              },
            });
          }),
        );
      }

      // disconnect suppliers from order
      if (removedSupplierIds) {
        await Promise.all(
          removedSupplierIds?.map((removedSupplierId) => {
            return dbClient.procurementOrderSupplier.delete({
              where: {
                orderId_supplierId: {
                  orderId: id,
                  supplierId: removedSupplierId,
                },
              },
            });
          }),
        );
      }

      return res.status(200).json({ success: true, data: order });
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
