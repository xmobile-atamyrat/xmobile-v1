import { NextApiRequest, NextApiResponse } from 'next';
import { ResponseApi } from '@/pages/lib/types';
import { z } from 'zod';
import dbClient from '@/lib/dbClient';

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
      // res.status(400).json({ success: false, message: " " + error.errors[0].path })
      // let msg = "Couldn't add product to cart. "
      // if (error instanceof z.ZodError) {
      //     msg += error.errors[0].path + " not found/valid."
      // }
      res.status(400).json({ success: false, message: 'userNotFound' });
    }
  } else if (req.method === 'GET') {
    // console.log(data);
    // res.status(200).json({ success: true, data: data })

    try {
      const { userId } = FormSchema.omit({
        cartItemId: true,
        productId: true,
        quantity: true,
      }).parse(req.query);
      // res.status(200).json({ success: true, data: userId })

      // get cartItem, Products by userId

      const cartItems = await dbClient.cartItems.findMany({
        where: {
          userId,
        },
        include: { product: true },
      });

      res.status(200).json({ success: true, data: cartItems });
    } catch (error) {
      // console.error('Error fetching cart items:', error);
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ success: false, message: error.errors[0].message });
      } else {
        res
          .status(400)
          .json({ success: false, message: 'Something went wrong' });
      }
    }
  } else if (req.method === 'DELETE') {
    try {
      await dbClient.cartItems.delete({
        where: { id: data.id },
      });
      res.status(400).json({ success: true, data: [] });
    } catch (error) {
      res
        .status(400)
        .json({ success: false, message: "Couldn't delete product from cart" });
    }
  }
}
