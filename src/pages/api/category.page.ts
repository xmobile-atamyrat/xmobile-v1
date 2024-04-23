import dbClient from '@/lib/dbClient';
import { ResponseApi } from '@/pages/lib/types';
import { Category, Product } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

export async function getCategory(
  categoryId: string,
): Promise<
  (Category & { products: Product[]; successorCategories: Category[] }) | null
> {
  const category = await dbClient.category.findUnique({
    where: {
      id: categoryId,
    },
    include: {
      products: true,
      successorCategories: true,
    },
  });
  return category;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  const { body, method, query } = req;
  if (method === 'GET') {
    try {
      if (query.categoryId == null)
        return res
          .status(400)
          .json({ success: false, message: 'categoryId is not provided' });
      const category = await getCategory(query.categoryId as string);
      return res.status(200).json({ success: true, data: category });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ success: false, message: "Couldn't get categories" });
    }
  } else if (method === 'POST') {
    try {
      const { name, predecessorId } = body as Category;
      const category = await dbClient.category.create({
        data: {
          name,
          predecessorId,
        },
      });
      return res.status(200).json({ success: true, data: category });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ success: false, message: "Couldn't create a new category" });
    }
  }
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}
