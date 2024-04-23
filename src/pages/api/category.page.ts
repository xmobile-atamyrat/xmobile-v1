import dbClient from '@/lib/dbClient';
import { ExtendedCategory, ResponseApi } from '@/pages/lib/types';
import { Category } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

export async function getCategory(
  categoryId: string,
): Promise<ExtendedCategory | null> {
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

async function recursivelyGetCategories(
  categories: ExtendedCategory[],
): Promise<ExtendedCategory[]> {
  // eslint-disable-next-line no-restricted-syntax
  for (const category of categories) {
    const { successorCategories } = (await dbClient.category.findUnique({
      where: { id: category.id },
      include: { successorCategories: true },
    }))!;
    category.successorCategories = successorCategories;
    if (successorCategories.length > 0) {
      await recursivelyGetCategories(successorCategories);
    }
  }
  return categories;
}

async function handleGetCategory(query: {
  categoryId?: string;
}): Promise<{ resp: ResponseApi; status: number }> {
  if (query.categoryId == null) {
    const categories = await dbClient.category.findMany({
      where: {
        predecessorId: null,
      },
    });
    const nestedCategories = await recursivelyGetCategories(categories);
    return { resp: { success: true, data: nestedCategories }, status: 200 };
  }
  const category = await getCategory(query.categoryId as string);
  return { resp: { success: true, data: category }, status: 200 };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  const { body, method, query } = req;
  if (method === 'GET') {
    try {
      const { resp, status } = await handleGetCategory(query);
      return res.status(status).json(resp);
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
