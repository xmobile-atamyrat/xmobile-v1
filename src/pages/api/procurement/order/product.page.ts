import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ProcurementOrderProduct } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/procurement/order/product.page.ts';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  addCors(res);

  try {
    const { userId, method } = req as AuthenticatedRequest;
    const user = await dbClient.user.findUnique({
      where: { id: userId },
    });
    if (!user || user.grade !== 'SUPERUSER') {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (method === 'PUT') {
      const { orderId, productId, ordered }: Partial<ProcurementOrderProduct> =
        req.body;
      const procurementOrderProduct =
        await dbClient.procurementOrderProduct.update({
          where: {
            orderId_productId: {
              orderId,
              productId,
            },
          },
          data: {
            ordered,
          },
        });
      return res
        .status(200)
        .json({ success: true, data: procurementOrderProduct });
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
