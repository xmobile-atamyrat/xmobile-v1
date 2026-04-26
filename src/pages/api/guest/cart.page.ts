import dbClient from '@/lib/dbClient';
import { whereActiveProduct } from '@/lib/prismaActiveScope';
import addCors from '@/pages/api/utils/addCors';
import { getOrCreateGuestSessionId } from '@/pages/api/utils/guestSession';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

const filepath = 'src/pages/api/guest/cart.page.ts';

const createSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1),
});

const updateSchema = z.object({
  id: z.string(),
  quantity: z.number().int().min(1),
});

const deleteSchema = z.object({
  id: z.string(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);
  const { method, body } = req;
  const guestSessionId = getOrCreateGuestSessionId(req, res);

  if (method === 'GET') {
    try {
      const cartItems = await dbClient.guestCartItem.findMany({
        where: {
          guestSessionId,
          product: whereActiveProduct,
        },
        include: { product: true },
      });
      return res.status(200).json({ success: true, data: cartItems });
    } catch (error) {
      console.error(filepath, error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  }

  if (method === 'POST') {
    try {
      const { productId, quantity } = createSchema.parse(body);

      const product = await dbClient.product.findFirst({
        where: { id: productId, ...whereActiveProduct },
      });
      if (!product) {
        return res
          .status(404)
          .json({ success: false, message: 'Product not found' });
      }

      const existing = await dbClient.guestCartItem.findFirst({
        where: { guestSessionId, productId },
      });
      if (existing) {
        return res
          .status(400)
          .json({ success: false, message: 'cartItemExistError' });
      }

      await dbClient.guestCartItem.create({
        data: { guestSessionId, productId, quantity },
      });
      return res.status(200).json({ success: true, data: { quantity } });
    } catch (error) {
      console.error(filepath, error);
      return res.status(400).json({
        success: false,
        message: (error as Error).message,
      });
    }
  }

  if (method === 'PUT') {
    try {
      const { id, quantity } = updateSchema.parse(body);
      const updated = await dbClient.guestCartItem.updateMany({
        where: { id, guestSessionId },
        data: { quantity },
      });
      if (!updated.count) {
        return res
          .status(404)
          .json({ success: false, message: 'Cart item not found' });
      }
      return res.status(200).json({ success: true, data: { quantity } });
    } catch (error) {
      console.error(filepath, error);
      return res.status(400).json({
        success: false,
        message: (error as Error).message,
      });
    }
  }

  if (method === 'DELETE') {
    try {
      const { id } = deleteSchema.parse(body);
      const deleted = await dbClient.guestCartItem.deleteMany({
        where: { id, guestSessionId },
      });
      if (!deleted.count) {
        return res
          .status(404)
          .json({ success: false, message: 'Cart item not found' });
      }
      return res.status(200).json({ success: true, data: [] });
    } catch (error) {
      console.error(filepath, error);
      return res.status(400).json({
        success: false,
        message: (error as Error).message,
      });
    }
  }

  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}
