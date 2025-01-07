import { NextApiRequest, NextApiResponse } from 'next';
import { ResponseApi } from '@/pages/lib/types';
import { z } from 'zod';
import dbClient from '@/lib/dbClient';

const filepath = 'src/pages/api/cart.page.ts';
const FormSchema = z.object({
  userId: z.string().min(1, 'userNotFound'),
  cartItemId: z.string(),
  productId: z.string(),
  quantity: z.number(),
});

const CreateCartItem = FormSchema.omit({ cartItemId: true });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  const data = req.body;

  if (req.method === 'PUT') {
    try {
      // validate the data input
      const { userId, productId, quantity } = CreateCartItem.parse({
        userId: data.userId,
        productId: data.productId,
        quantity: data.quantity,
      });

      await dbClient.cartItems.upsert({
        where: {
          userId_productId: { userId, productId },
        },
        update: {
          quantity: { increment: quantity },
        },
        create: {
          userId,
          productId,
          quantity,
        },
      });

      res.status(200).json({ success: true, data: { quantity } });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  } else if (req.method === 'GET') {
    try {
      const { userId } = FormSchema.omit({
        cartItemId: true,
        productId: true,
        quantity: true,
      }).parse(req.query);

      // get cartItem, Products by userId
      const cartItems = await dbClient.cartItems.findMany({
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
      await dbClient.cartItems.delete({
        where: { id: data.id },
      });
      res.status(200).json({ success: true, data: [] });
    } catch (error) {
      res
        .status(400)
        .json({ success: false, message: "Couldn't delete product from cart" });
    }
  }
}
