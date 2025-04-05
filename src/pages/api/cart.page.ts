import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

const filepath = 'src/pages/api/cart.page.ts';
const FormSchema = z.object({
  cartItemId: z.string(),
  productId: z.string(),
  quantity: z.number(),
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
      const { productId, quantity } = CreateCartItem.parse({
        productId: data.productId,
        quantity: data.quantity,
      });

      // delete if product and cart has a relation
      const cartItemExist = await dbClient.cartItem.findFirst({
        where: { userId, productId },
      });

      if (!cartItemExist) {
        await dbClient.cartItem.create({
          data: {
            userId,
            productId,
            quantity,
          },
        });

        res.status(200).json({ success: true, data: { quantity } });
      } else {
        res.status(400).json({ success: false, message: 'cartItemExistError' });
      }
    } catch (error) {
      console.error(filepath, error);
      res.status(400).json({ success: false, message: error.message });
    }
  } else if (req.method === 'GET') {
    try {
      const cartItems = await dbClient.cartItem.findMany({
        where: {
          userId,
        },
        include: { product: true },
      });

      res.status(200).json({ success: true, data: cartItems });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: `Type of data's are incorrect. ${error.errors[0].message}`,
        });
      } else {
        console.error(filepath, error);
        res.status(500).json({ success: false, message: error.message });
      }
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

      const cartItem = await dbClient.cartItem.update({
        where: { id: cartItemId, userId },
        data: {
          quantity,
        },
      });

      res
        .status(200)
        .json({ success: true, data: { quantity: cartItem.quantity } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: `${filepath}: quantity/cartId type is incorrect`,
        });
      }
      console.error(filepath, error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default withAuth(handler);
