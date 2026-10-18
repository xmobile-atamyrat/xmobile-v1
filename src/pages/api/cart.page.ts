import dbClient from '@/lib/dbClient';
import { whereActiveProduct } from '@/lib/prismaActiveScope';
import { unavailableVariantTags } from '@/lib/variantStock';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import logRequestError from '@/pages/api/utils/logRequestError';
import { MAX_CART_QUANTITY } from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

const filepath = 'src/pages/api/cart.page.ts';
const FormSchema = z.object({
  cartItemId: z.string(),
  productId: z.string(),
  quantity: z.number().int().min(1).max(MAX_CART_QUANTITY),
  selectedVariant: z.string().nullish(),
});

const CreateCartItem = FormSchema.omit({ cartItemId: true });
const EditCartItem = FormSchema.omit({ productId: true });

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseApi>) {
  addCors(res);
  const data = req.body;
  const { userId } = req as AuthenticatedRequest;

  if (req.method === 'POST') {
    try {
      // validate the data input
      const { productId, quantity, selectedVariant } = CreateCartItem.parse({
        productId: data.productId,
        quantity: data.quantity,
        selectedVariant: data.selectedVariant,
      });

      // A product can exist in the cart multiple times with different variants
      const cartItemExist = await dbClient.cartItem.findFirst({
        where: { userId, productId, selectedVariant: selectedVariant ?? null },
      });

      // A hidden line below 1 holds the unique slot, so adding the product
      // again sets its quantity instead of reporting a duplicate.
      if (cartItemExist && cartItemExist.quantity < 1) {
        await dbClient.cartItem.update({
          where: { id: cartItemExist.id },
          data: { quantity },
        });
        res.status(200).json({ success: true, data: { quantity } });
        return;
      }

      if (!cartItemExist) {
        const productOk = await dbClient.product.findFirst({
          where: { id: productId, ...whereActiveProduct },
        });
        if (!productOk) {
          res.status(404).json({
            success: false,
            message: 'Product not found',
          });
          return;
        }

        await dbClient.cartItem.create({
          data: {
            userId,
            productId,
            quantity,
            selectedVariant: selectedVariant ?? null,
          },
        });

        res.status(200).json({ success: true, data: { quantity } });
      } else {
        res.status(400).json({ success: false, message: 'cartItemExistError' });
      }
    } catch (error) {
      logRequestError(filepath, error);
      res.status(400).json({ success: false, message: error.message });
    }
  } else if (req.method === 'GET') {
    try {
      if (req.query.count != null) {
        const count = await dbClient.cartItem.count({
          where: {
            userId,
            quantity: { gte: 1 },
            product: whereActiveProduct,
          },
        });
        res.status(200).json({ success: true, data: { count } });
        return;
      }

      // Older rows can hold a quantity below 1 from before it was validated;
      // they are hidden here and left out of orders.
      const cartItems = await dbClient.cartItem.findMany({
        where: {
          userId,
          quantity: { gte: 1 },
          product: whereActiveProduct,
        },
        include: { product: true },
      });

      // Stock lives on the price as well as the product, so each line carries
      // its own variant's state. Resolved here rather than in the client so the
      // cart never has to fetch a price row per item to know what it can buy.
      const unavailable = await unavailableVariantTags(
        cartItems.map((item) => item.selectedVariant),
      );
      const itemsWithStock = cartItems.map((item) => ({
        ...item,
        variantOutOfStock:
          item.selectedVariant != null && unavailable.has(item.selectedVariant),
      }));

      res.status(200).json({ success: true, data: itemsWithStock });
    } catch (error) {
      console.error(filepath, error);
      res.status(500).json({ success: false, message: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      await dbClient.cartItem.delete({
        where: { id: data.id, userId },
      });
      res.status(200).json({ success: true, data: [] });
    } catch (error) {
      console.error(filepath, error);
      res
        .status(400)
        .json({ success: false, message: "Couldn't delete product from cart" });
    }
  } else if (req.method === 'PUT') {
    try {
      const { cartItemId, quantity } = EditCartItem.parse({
        cartItemId: data.id,
        quantity: data.quantity,
      });

      // updateMany so an item deleted in another tab is a 404, not a throw.
      const updated = await dbClient.cartItem.updateMany({
        where: { id: cartItemId, userId },
        data: { quantity },
      });
      if (!updated.count) {
        res
          .status(404)
          .json({ success: false, message: 'Cart item not found' });
        return;
      }

      res.status(200).json({ success: true, data: { quantity } });
    } catch (error) {
      logRequestError(filepath, error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: `${filepath}: quantity/cartId type is incorrect`,
        });
        return;
      }
      res.status(500).json({ success: false, message: error.message });
    }
  } else {
    console.error(`${filepath}: Method not allowed`);
    res.status(405).json({ success: false, message: 'Method not allowed' });
  }
}

export default withAuth(handler);
