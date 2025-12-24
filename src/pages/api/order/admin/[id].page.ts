import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';
import {
  getAdminOrderController,
  updateAdminNotesController,
  updateOrderStatusController,
} from '../controllers/adminOrderController';
import { checkAdmin } from '../utils/checkAdmin';

const filepath = 'src/pages/api/order/admin/[id].page.ts';

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseApi>) {
  addCors(res);
  const { method, query, body } = req;
  const { userId } = req as AuthenticatedRequest;
  const orderId = query.id as string;

  // Check admin permissions
  if (!userId || !(await checkAdmin(userId))) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'Order ID is required',
    });
  }

  if (method === 'GET') {
    try {
      const { resp, status } = await getAdminOrderController(orderId);
      return res.status(status).json(resp);
    } catch (error: any) {
      console.error(filepath, error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch order',
      });
    }
  } else if (method === 'PUT') {
    // Determine action: status update or notes update
    const action = query.action as string;

    if (action === 'status') {
      try {
        const { resp, status } = await updateOrderStatusController(
          orderId,
          body,
        );
        return res.status(status).json(resp);
      } catch (error: any) {
        console.error(filepath, error);
        return res.status(500).json({
          success: false,
          message: error.message || 'Failed to update order status',
        });
      }
    } else if (action === 'notes') {
      try {
        const { resp, status } = await updateAdminNotesController(
          orderId,
          body,
        );
        return res.status(status).json(resp);
      } catch (error: any) {
        console.error(filepath, error);
        return res.status(500).json({
          success: false,
          message: error.message || 'Failed to update admin notes',
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use ?action=status or ?action=notes',
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
