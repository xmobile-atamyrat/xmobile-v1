import addCors from '@/pages/api/utils/addCors';
import { getOrCreateGuestSessionId } from '@/pages/api/utils/guestSession';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';
import { getGuestOrderById } from '../../order/services/orderService';

const filepath = 'src/pages/api/guest/order/[id].page.ts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);
  const { method, query } = req;
  const orderId = query.id as string;
  const guestSessionId = getOrCreateGuestSessionId(req, res);

  if (!orderId) {
    return res
      .status(400)
      .json({ success: false, message: 'Order ID is required' });
  }

  if (method === 'GET') {
    try {
      const order = await getGuestOrderById(orderId, guestSessionId);
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: 'Order not found' });
      }
      return res.status(200).json({ success: true, data: order });
    } catch (error: any) {
      console.error(filepath, error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch guest order',
      });
    }
  }

  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}
