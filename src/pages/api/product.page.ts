import dbClient from '@/lib/dbClient';
import { getCategory } from '@/pages/api/category.page';
import { ResponseApi } from '@/pages/lib/types';
import { Product } from '@prisma/client';
import fs from 'fs';
import multiparty from 'multiparty';
import { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface CreateProductReturnType {
  success: boolean;
  message?: string;
  status: number;
  data?: Product;
}

async function createProduct(
  req: NextApiRequest,
): Promise<CreateProductReturnType> {
  const form = new multiparty.Form({
    uploadDir: process.env.PRODUCT_IMAGES_DIR,
  });
  const promise: Promise<CreateProductReturnType> = new Promise((resolve) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.log(err);
        resolve({ success: false, message: err.message, status: 500 });
      }
      const product = await dbClient.product.create({
        data: {
          name: fields.name[0],
          categoryId: fields.categoryId[0],
          description: fields.description?.[0],
          imgUrl: fields.imageUrl?.[0] ?? files.imageUrl?.[0].path,
          price: fields.price?.[0],
        },
      });
      resolve({ success: true, data: product, status: 200 });
    });
  });
  const res = await promise;
  return res;
}

async function getProduct(productId: string): Promise<Product | null> {
  const product = await dbClient.product.findUnique({
    where: {
      id: productId,
    },
  });
  return product;
}

async function handleGetProduct(query: {
  searchKeyword?: string;
  categoryId?: string;
  productId?: string;
}): Promise<{ resp: ResponseApi; status: number }> {
  const { searchKeyword, productId, categoryId } = query;
  if (searchKeyword != null) {
    const products = await dbClient.product.findMany({
      where: {
        OR: [
          {
            name: {
              contains: searchKeyword,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: searchKeyword,
              mode: 'insensitive',
            },
          },
          {
            price: {
              contains: searchKeyword,
              mode: 'insensitive',
            },
          },
        ],
      },
    });
    return { resp: { success: true, data: products }, status: 200 };
  }
  if (productId != null) {
    const product = await getProduct(productId as string);
    if (product == null)
      return {
        resp: { success: false, message: "Couldn't find the product" },
        status: 404,
      };
    return { resp: { success: true, data: product }, status: 200 };
  }
  if (categoryId != null) {
    const category = await getCategory(categoryId as string);
    if (category == null)
      return {
        resp: { success: false, message: "Couldn't find the category" },
        status: 404,
      };

    const { successorCategories, products } = category;
    if (successorCategories?.length === 0)
      return { resp: { success: true, data: products }, status: 200 };

    const queue = successorCategories!;
    const allProducts = products!;
    while (queue.length > 0) {
      const { id } = queue.shift()!;
      const { products: sucProducts, successorCategories: newSucCat } =
        (await getCategory(id as string))!;
      allProducts.push(...sucProducts!);
      queue.push(...newSucCat!);
    }

    return { resp: { success: true, data: allProducts }, status: 200 };
  }
  return {
    resp: {
      success: false,
      message: 'Neither categoryId nor productId has been provided',
    },
    status: 404,
  };
}

async function handleEditProduct(
  req: NextApiRequest,
): Promise<CreateProductReturnType> {
  const { productId } = req.query;
  const form = new multiparty.Form({
    uploadDir: process.env.PRODUCT_IMAGES_DIR,
  });
  const promise: Promise<CreateProductReturnType> = new Promise((resolve) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error(err);
        resolve({ success: false, message: err.message, status: 500 });
      }

      const data: Partial<Product> = {};
      if (fields.name?.length > 0) data.name = fields.name[0];
      if (fields.description?.length > 0)
        data.description = fields.description[0];
      if (fields.price?.length > 0) data.price = fields.price[0];
      if (files.imageUrl?.length > 0) {
        const currProduct = await dbClient.product.findUnique({
          where: {
            id: productId as string,
          },
        });
        if (currProduct?.imgUrl != null && fs.existsSync(currProduct.imgUrl)) {
          fs.unlinkSync(currProduct.imgUrl);
        }
        data.imgUrl = files.imageUrl?.[0].path;
      } else if (fields.imageUrl?.length > 0) data.imgUrl = fields.imageUrl[0];

      const product = await dbClient.product.update({
        where: {
          id: productId as string,
        },
        data,
      });
      resolve({ success: true, data: product, status: 200 });
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
  if (method === 'POST') {
    try {
      const retData = await createProduct(req);
      return res.status(200).json(retData);
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: "Couldn't create a new product" });
    }
  } else if (method === 'GET') {
    try {
      const { resp, status } = await handleGetProduct(query);
      return res.status(status).json(resp);
    } catch (error) {
      return {
        resp: { success: false, message: "Couldn't find the product/s" },
        status: 500,
      };
    }
  } else if (method === 'DELETE') {
    const { productId } = query;
    if (productId == null)
      return res
        .status(404)
        .json({ success: false, message: 'No product id provided' });

    const product = await dbClient.product.delete({
      where: {
        id: productId as string,
      },
    });
    if (product?.imgUrl != null && fs.existsSync(product.imgUrl)) {
      fs.unlinkSync(product.imgUrl);
    }
    return res.status(200).json({ success: true });
  } else if (method === 'PUT') {
    const { productId } = query;
    if (productId == null)
      return res
        .status(404)
        .json({ success: false, message: 'No product id provided' });

    try {
      const retData = await handleEditProduct(req);
      return res.status(200).json(retData);
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ success: false, message: "Couldn't update the product" });
    }
  }
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}
