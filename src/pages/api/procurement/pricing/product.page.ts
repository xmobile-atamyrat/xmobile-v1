import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/procurement/pricing/product.page.ts';

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
    if (method === 'PUT') {
      const {
        orderId,
        productId,
        singleProductPrice,
        singleProductPercent,
        bulkProductPrice,
        bulkProductPercent,
        finalSinglePrice,
        finalBulkPrice,
        comment,
        orderReceived,
      } = req.body;

      if (!orderId || !productId) {
        return res.status(400).json({
          success: false,
          message: 'Order ID and Product ID are required',
        });
      }

      const updatedProduct = await dbClient.procurementOrderProduct.update({
        where: {
          orderId_productId: {
            orderId,
            productId,
          },
        },
        data: {
          singleProductPrice,
          singleProductPercent,
          bulkProductPrice,
          bulkProductPercent,
          finalSinglePrice,
          finalBulkPrice,
          comment,
          orderReceived,
        },
        include: {
          product: true,
          order: true,
        },
      });

      // If orderReceived is true, update the global ProductPrice table
      if (orderReceived && finalSinglePrice && finalBulkPrice) {
        await dbClient.productPrice.upsert({
          where: {
            productId,
          },
          update: {
            originalPrice: singleProductPrice,
            originalCurrency: updatedProduct.order.currency,
            bulkPrice: finalBulkPrice,
            singlePrice: finalSinglePrice,
            lastUpdatedFromOrderId: orderId,
            lastUpdatedFromProductId: updatedProduct.id,
          },
          create: {
            productId,
            originalPrice: singleProductPrice,
            originalCurrency: updatedProduct.order.currency,
            bulkPrice: finalBulkPrice,
            singlePrice: finalSinglePrice,
            lastUpdatedFromOrderId: orderId,
            lastUpdatedFromProductId: updatedProduct.id,
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: updatedProduct,
      });
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
