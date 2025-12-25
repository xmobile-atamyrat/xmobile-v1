import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';
import {
  createOrderController,
  getUserOrdersController,
} from './controllers/orderController';
import { getOrdersQuerySchema } from './validators/orderValidators';

const filepath = 'src/pages/api/order/index.page.ts';

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseApi>) {
  addCors(res);
  const { method, query, body } = req;
  const { userId } = req as AuthenticatedRequest;

  if (method === 'POST') {
    try {
      const { resp, status } = await createOrderController(body, userId!);
      return res.status(status).json(resp);
    } catch (error: any) {
      console.error(filepath, error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create order',
      });
    }
  } else if (method === 'GET') {
    try {
      const validated = getOrdersQuerySchema.parse(query);
      const { resp, status } = await getUserOrdersController({
        ...validated,
      });
      return res.status(status).json(resp);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: `Validation error: ${error.errors[0].message}`,
        });
      }
      console.error(filepath, error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch orders',
      });
    }
  } else {
    console.error(`${filepath}: Method not allowed`);
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }
}

export default withAuth(handler);
