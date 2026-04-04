import dbClient from '@/lib/dbClient';
import { syncBrandProductCount } from '@/lib/brandProductCount';
import { whereActiveCategory } from '@/lib/prismaActiveScope';
import { getPrice } from '@/pages/api/prices/index.page';
import addCors from '@/pages/api/utils/addCors';
import { ExtendedCategory, ResponseApi } from '@/pages/lib/types';
import { Category } from '@prisma/client';
import fs from 'fs';
import multiparty from 'multiparty';
import { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: false,
  },
};

const filepath = 'src/pages/api/category.page.ts';

export async function getCategory(
  categoryId: string,
): Promise<ExtendedCategory | null> {
  const category = await dbClient.category.findFirst({
    where: {
      id: categoryId,
      deletedAt: null,
    },
    include: {
      products: {
        where: { deletedAt: null },
      },
      successorCategories: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  const categoryProductsWithPrices = await Promise.all(
    category.products.map(async (product) => {
      const productPrice = await getPrice(product.price as string);
      if (productPrice != null)
        product.price = `${product.price}{${productPrice?.priceInTmt}}`;

      return product;
    }),
  );

  category.products = categoryProductsWithPrices;

  return category;
}

async function recursivelyGetCategories(
  categories: ExtendedCategory[],
): Promise<ExtendedCategory[]> {
  const updatedCategories = await Promise.all(
    categories.map(async (category) => {
      const { successorCategories } =
        (await dbClient.category.findFirst({
          where: { id: category.id, deletedAt: null },
          include: {
            successorCategories: {
              where: { deletedAt: null },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        })) || {};

      category.successorCategories = successorCategories;

      if (successorCategories && successorCategories.length > 0) {
        category.successorCategories =
          await recursivelyGetCategories(successorCategories);
      }

      return category;
    }),
  );

  return updatedCategories;
}

/** Active category ids in subtree (root + descendants), excluding already-deleted rows. */
async function collectActiveSubtreeCategoryIds(
  rootId: string,
): Promise<string[]> {
  const root = await dbClient.category.findFirst({
    where: { id: rootId, deletedAt: null },
    include: {
      successorCategories: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
  });
  if (!root) return [];
  const nested = await Promise.all(
    root.successorCategories.map(({ id }) =>
      collectActiveSubtreeCategoryIds(id),
    ),
  );
  return [root.id, ...nested.flat()];
}

async function handleGetCategory(query: {
  categoryId?: string;
}): Promise<{ resp: ResponseApi; status: number }> {
  if (query.categoryId == null) {
    const categories = await dbClient.category.findMany({
      where: {
        predecessorId: null,
        ...whereActiveCategory,
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
    uploadDir: process.env.CATEGORY_IMAGES_DIR,
  });

  const promise: Promise<{
    success: boolean;
    message?: string;
    status: number;
    data?: Category;
  }> = new Promise((resolve) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error(filepath, err);
        resolve({ success: false, message: err.message, status: 500 });
        return;
      }
      const predId = fields.predecessorId?.[0];
      if (predId) {
        const parent = await dbClient.category.findFirst({
          where: { id: predId, deletedAt: null },
        });
        if (!parent) {
          resolve({
            success: false,
            message: 'Parent category not found',
            status: 404,
          });
          return;
        }
      }

      const category = await dbClient.category.create({
        data: {
          name: fields.name[0],
          predecessorId: predId,
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
    uploadDir: process.env.CATEGORY_IMAGES_DIR,
  });

  const promise: Promise<{
    success: boolean;
    message?: string;
    status: number;
    data?: Category;
  }> = new Promise((resolve) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error(filepath, err);
        resolve({ success: false, message: err.message, status: 500 });
        return;
      }

      const existingCat = await dbClient.category.findFirst({
        where: { id: categoryId as string, deletedAt: null },
      });
      if (!existingCat) {
        resolve({
          success: false,
          message: 'Category not found',
          status: 404,
        });
        return;
      }

      const data: Partial<Category> = {};
      if (fields.name?.length > 0) data.name = fields.name[0];
      if (files.imageUrl?.length > 0) {
        if (existingCat.imgUrl != null && fs.existsSync(existingCat.imgUrl)) {
          fs.unlinkSync(existingCat.imgUrl);
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
  addCors(res);
  const { method, query } = req;
  if (method === 'GET') {
    try {
      const { resp, status } = await handleGetCategory(query);
      return res.status(status).json(resp);
    } catch (error) {
      console.error(filepath, error);
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
      console.error(filepath, error);
      res
        .status(500)
        .json({ success: false, message: "Couldn't create a new category" });
    }
  } else if (method === 'PUT') {
    const { categoryId } = query;
    if (categoryId == null) {
      console.error(filepath, `Category ID not provided. Method: ${method}`);
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
      console.error(filepath, error);
      return res
        .status(500)
        .json({ success: false, message: "Couldn't edit the category" });
    }
  } else if (method === 'DELETE') {
    const { categoryId } = query;
    if (categoryId == null) {
      console.error(filepath, `Category ID not provided. Method: ${method}`);
      return res
        .status(400)
        .json({ success: false, message: 'Category ID not provided' });
    }
    try {
      const subtreeIds = await collectActiveSubtreeCategoryIds(
        categoryId as string,
      );
      if (subtreeIds.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Category not found',
        });
      }

      const productsToSoftDelete = await dbClient.product.findMany({
        where: {
          categoryId: { in: subtreeIds },
          deletedAt: null,
        },
        select: { id: true, brandId: true },
      });

      const brandIds = new Set(
        productsToSoftDelete
          .map((p) => p.brandId)
          .filter((id): id is string => id != null),
      );

      const now = new Date();

      await dbClient.$transaction(async (tx) => {
        await tx.product.updateMany({
          where: {
            categoryId: { in: subtreeIds },
            deletedAt: null,
          },
          data: { deletedAt: now },
        });
        await tx.category.updateMany({
          where: { id: { in: subtreeIds } },
          data: { deletedAt: now },
        });
        await tx.cartItem.deleteMany({
          where: { productId: { in: productsToSoftDelete.map((p) => p.id) } },
        });
      });

      await Promise.all([...brandIds].map((bid) => syncBrandProductCount(bid)));

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error(filepath, error);
      return res
        .status(500)
        .json({ success: false, message: "Couldn't delete the category" });
    }
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}
