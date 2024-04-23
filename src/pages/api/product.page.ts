import dbClient from '@/lib/dbClient';
import { getCategory } from '@/pages/api/category.page';
import { ResponseApi } from '@/pages/lib/types';
import { Product } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

async function createProduct(body: Product): Promise<Product> {
  const { name, description, imgUrl, price, categoryId } = body;
  const product = await dbClient.product.create({
    data: {
      name,
      categoryId,
      description,
      imgUrl,
      price,
    },
  });
  return product;
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
  categoryId?: string;
  productId?: string;
}): Promise<{ resp: ResponseApi; status: number }> {
  const { productId, categoryId } = query;
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  const { body, method, query } = req;
  if (method === 'POST') {
    try {
      const product = await createProduct(body);
      return res.status(200).json({ success: true, data: product });
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
  }
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}
