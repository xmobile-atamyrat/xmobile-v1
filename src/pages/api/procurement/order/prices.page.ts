import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ProcurementSupplierProductPrice } from '@prisma/client';
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
      const supplierId = req.query.supplierId as string;
      if (productId && supplierId) {
        const price = await dbClient.procurementSupplierProductPrice.findUnique(
          {
            where: {
              supplierId_productId_orderId: {
                supplierId,
                productId,
                orderId,
              },
            },
          },
        );
        return res.status(200).json({ success: true, data: price });
      }
      const allPrices = await dbClient.procurementSupplierProductPrice.findMany(
        {
          where: {
            orderId,
          },
        },
      );
      return res.status(200).json({ success: true, data: allPrices });
    }
    if (method === 'POST') {
      const { orderId, productId, supplierId, price } = req.body;
      const newPrice = await dbClient.procurementSupplierProductPrice.create({
        data: {
          orderId,
          productId,
          supplierId,
          price,
        },
      });
      return res.status(200).json({ success: true, data: newPrice });
    }
    if (method === 'PUT') {
      const updatedPrices: Partial<ProcurementSupplierProductPrice>[] =
        req.body;
      await Promise.all(
        updatedPrices.map(
          async ({ orderId, price, productId, supplierId, color }) => {
            await dbClient.procurementSupplierProductPrice.upsert({
              where: {
                supplierId_productId_orderId: {
                  supplierId,
                  productId,
                  orderId,
                },
              },
              update: {
                price,
                color,
              },
              create: {
                orderId,
                productId,
                supplierId,
                price,
              },
            });
          },
        ),
      );
      return res.status(200).json({ success: true });
    }
    if (method === 'DELETE') {
      const { ids }: { ids: Partial<ProcurementSupplierProductPrice>[] } =
        req.body;
      await Promise.all(
        ids.map(async ({ supplierId, productId, orderId }) => {
          await dbClient.procurementSupplierProductPrice.delete({
            where: {
              supplierId_productId_orderId: {
                supplierId,
                productId,
                orderId,
              },
            },
          });
        }),
      );
      return res.status(200).json({ success: true });
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
