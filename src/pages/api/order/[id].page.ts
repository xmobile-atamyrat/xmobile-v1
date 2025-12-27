import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';
import {
  cancelOrderController,
  getOrderController,
} from './controllers/orderController';

const filepath = 'src/pages/api/order/[id].page.ts';

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseApi>) {
  addCors(res);
  const { method, query, body } = req;
  const { userId } = req as AuthenticatedRequest;
  const orderId = query.id as string;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'Order ID is required',
    });
  }

  if (method === 'GET') {
    try {
      const { resp, status } = await getOrderController(
        orderId,
        userId!,
        false,
      );
      return res.status(status).json(resp);
    } catch (error: any) {
      console.error(filepath, error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch order',
      });
    }
  } else if (method === 'PUT') {
    // Check if this is a cancel request (based on URL pattern or body)
    const isCancel = query.action === 'cancel' || body?.action === 'cancel';

    if (isCancel) {
      try {
        const { resp, status } = await cancelOrderController(
          orderId,
          userId!,
          body,
        );
        return res.status(status).json(resp);
      } catch (error: any) {
        console.error(filepath, error);
        return res.status(500).json({
          success: false,
          message: error.message || 'Failed to cancel order',
        });
      }
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid action. Use ?action=cancel to cancel an order',
    });
  } else {
    console.error(`${filepath}: Method not allowed`);
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }
}

export default withAuth(handler);
