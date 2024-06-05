import dbClient from '@/lib/dbClient';
import { ExtendedCategory, ResponseApi } from '@/pages/lib/types';
import { Category } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import multiparty from 'multiparty';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
      include: {
        successorCategories: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
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
      orderBy: {
        createdAt: 'asc',
      },
    });
    const nestedCategories = await recursivelyGetCategories(categories);
    return { resp: { success: true, data: nestedCategories }, status: 200 };
  }
  const category = await getCategory(query.categoryId as string);
  return { resp: { success: true, data: category }, status: 200 };
}

async function handlePostCategory(req: NextApiRequest) {
  const form = new multiparty.Form({
    uploadDir: 'src/db/images/categories/',
  });

  const promise: Promise<{
    success: boolean;
    message?: string;
    status: number;
    data?: Category;
  }> = new Promise((resolve) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.log(err);
        resolve({ success: false, message: err.message, status: 500 });
      }
      const category = await dbClient.category.create({
        data: {
          name: fields.name[0],
          predecessorId: fields.predecessorId?.[0],
          imgUrl: files.imageUrl?.[0].path ?? fields.imageUrl?.[0],
        },
      });
      resolve({ success: true, data: category, status: 200 });
    });
  });
  const res = await promise;
  return res;
}

async function handleEditCategory(req: NextApiRequest) {
  const { categoryId } = req.query;
  const form = new multiparty.Form({
    uploadDir: 'src/db/images/categories/',
  });

  const promise: Promise<{
    success: boolean;
    message?: string;
    status: number;
    data?: Category;
  }> = new Promise((resolve) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.log(err);
        resolve({ success: false, message: err.message, status: 500 });
      }
      const data: Partial<Category> = {};
      if (fields.name?.length > 0) data.name = fields.name[0];
      if (files.imageUrl?.length > 0) {
        const currCat = await dbClient.category.findUnique({
          where: {
            id: categoryId as string,
          },
        });
        if (currCat?.imgUrl != null && fs.existsSync(currCat.imgUrl)) {
          fs.unlinkSync(currCat.imgUrl);
        }
        data.imgUrl = files.imageUrl?.[0].path;
      } else if (fields.imageUrl?.length > 0) data.imgUrl = fields.imageUrl[0];

      const category = await dbClient.category.update({
        where: {
          id: categoryId as string,
        },
        data,
      });
      resolve({ success: true, data: category, status: 200 });
    });
  });
  const res = await promise;
  return res;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  const { method, query } = req;
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
      const { status, success, data, message } = await handlePostCategory(req);
      const retData: any = { success };
      if (message) retData.message = message;
      if (data) retData.data = data;
      return res.status(status).json(retData);
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ success: false, message: "Couldn't create a new category" });
    }
  } else if (method === 'PUT') {
    const { categoryId } = query;
    if (categoryId == null) {
      return res
        .status(400)
        .json({ success: false, message: 'Category ID not provided' });
    }
    try {
      const { status, success, data, message } = await handleEditCategory(req);
      const retData: any = { success };
      if (message) retData.message = message;
      if (data) retData.data = data;
      return res.status(status).json(retData);
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ success: false, message: "Couldn't edit the category" });
    }
  } else if (method === 'DELETE') {
    const { categoryId } = query;
    if (categoryId == null) {
      return res
        .status(400)
        .json({ success: false, message: 'Category ID not provided' });
    }
    try {
      const cat = await dbClient.category.delete({
        where: {
          id: categoryId as string,
        },
      });
      if (cat.imgUrl != null && fs.existsSync(cat.imgUrl)) {
        fs.unlinkSync(cat.imgUrl);
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ success: false, message: "Couldn't delete the category" });
    }
  }
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}
