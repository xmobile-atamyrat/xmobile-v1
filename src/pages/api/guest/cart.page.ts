import dbClient from '@/lib/dbClient';
import { whereActiveProduct } from '@/lib/prismaActiveScope';
import { unavailableVariantTags } from '@/lib/variantStock';
import addCors from '@/pages/api/utils/addCors';
import { getOrCreateGuestSessionId } from '@/pages/api/utils/guestSession';
import logRequestError from '@/pages/api/utils/logRequestError';
import {
  GUEST_SESSION_COOKIE_NAME,
  MAX_CART_QUANTITY,
} from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

const filepath = 'src/pages/api/guest/cart.page.ts';

const quantitySchema = z.coerce.number().int().min(1).max(MAX_CART_QUANTITY);

const createSchema = z.object({
  productId: z.string(),
  quantity: quantitySchema,
  selectedVariant: z.string().nullish(),
});

const updateSchema = z.object({
  id: z.string(),
  quantity: quantitySchema,
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

  // The header badge asks on every visit, so a visitor without a cart must not
  // be handed a guest session cookie just for looking.
  if (method === 'GET' && req.query.count != null) {
    try {
      const existingSessionId = req.cookies[GUEST_SESSION_COOKIE_NAME];
      const count = existingSessionId
        ? await dbClient.guestCartItem.count({
            where: {
              guestSessionId: existingSessionId,
              quantity: { gte: 1 },
              product: whereActiveProduct,
            },
          })
        : 0;
      return res.status(200).json({ success: true, data: { count } });
    } catch (error) {
      console.error(filepath, error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  }

  const guestSessionId = getOrCreateGuestSessionId(req, res);

  if (method === 'GET') {
    try {
      const cartItems = await dbClient.guestCartItem.findMany({
        where: {
          guestSessionId,
          quantity: { gte: 1 },
          product: whereActiveProduct,
        },
        include: { product: true },
      });

      // Same variant-level stock resolution as the signed-in cart — a guest
      // must not be shown a buyable price for a sold-out variant either.
      const unavailable = await unavailableVariantTags(
        cartItems.map((item) => item.selectedVariant),
      );
      const data = cartItems.map((item) => ({
        ...item,
        variantOutOfStock:
          item.selectedVariant != null && unavailable.has(item.selectedVariant),
      }));

      return res.status(200).json({ success: true, data });
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
      const { productId, quantity, selectedVariant } = createSchema.parse(body);

      const product = await dbClient.product.findFirst({
        where: { id: productId, ...whereActiveProduct },
      });
      if (!product) {
        return res
          .status(404)
          .json({ success: false, message: 'Product not found' });
      }

      const existing = await dbClient.guestCartItem.findFirst({
        where: {
          guestSessionId,
          productId,
          selectedVariant: selectedVariant ?? null,
        },
      });
      // A hidden line below 1 holds the unique slot, so adding the product
      // again sets its quantity instead of reporting a duplicate.
      if (existing && existing.quantity < 1) {
        await dbClient.guestCartItem.update({
          where: { id: existing.id },
          data: { quantity },
        });
        return res.status(200).json({ success: true, data: { quantity } });
      }
      if (existing) {
        return res
          .status(400)
          .json({ success: false, message: 'cartItemExistError' });
      }

      await dbClient.guestCartItem.create({
        data: {
          guestSessionId,
          productId,
          quantity,
          selectedVariant: selectedVariant ?? null,
        },
      });
      return res.status(200).json({ success: true, data: { quantity } });
    } catch (error) {
      logRequestError(filepath, error);
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
      logRequestError(filepath, error);
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
      logRequestError(filepath, error);
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
