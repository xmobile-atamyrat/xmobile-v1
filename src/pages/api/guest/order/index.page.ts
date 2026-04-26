import addCors from '@/pages/api/utils/addCors';
import { getOrCreateGuestSessionId } from '@/pages/api/utils/guestSession';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import {
  createGuestOrder,
  getGuestOrders,
} from '../../order/services/orderService';

const filepath = 'src/pages/api/guest/order/index.page.ts';

const createGuestOrderSchema = z.object({
  deliveryAddress: z.string().min(1, 'Delivery address is required'),
  deliveryPhone: z.string().min(1, 'Delivery phone is required'),
  notes: z.string().optional(),
  userName: z.string().optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);
  const { method, body } = req;
  const guestSessionId = getOrCreateGuestSessionId(req, res);

  if (method === 'POST') {
    try {
      const validated = createGuestOrderSchema.parse(body);
      const order = await createGuestOrder({
        guestSessionId,
        deliveryAddress: validated.deliveryAddress,
        deliveryPhone: validated.deliveryPhone,
        notes: validated.notes,
        userName: validated.userName,
      });
      return res.status(200).json({ success: true, data: order });
    } catch (error: any) {
      console.error(filepath, error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to create guest order',
      });
    }
  }

  if (method === 'GET') {
    try {
      const orders = await getGuestOrders(guestSessionId);
      return res.status(200).json({ success: true, data: orders });
    } catch (error: any) {
      console.error(filepath, error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch guest orders',
      });
    }
  }

  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}
