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
    const { productId, categoryId } = query;
    if (productId != null) {
      try {
        const product = await getProduct(productId as string);
        if (product == null)
          return res
            .status(404)
            .json({ success: false, message: "Couldn't find the product" });
        return res.status(200).json({ success: true, data: product });
      } catch (error) {
        return res
          .status(500)
          .json({ success: false, message: "Couldn't find the product" });
      }
    } else if (categoryId != null) {
      const category = await getCategory(categoryId as string);
      if (category == null)
        return res
          .status(404)
          .json({ success: false, message: "Couldn't find the category" });

      const { successorCategories, products } = category;
      if (successorCategories?.length === 0)
        return res.status(200).json({ success: true, data: products });

      const queue = successorCategories;
      const allProducts = products;
      while (queue.length > 0) {
        const { id } = queue.shift()!;
        const { products: sucProducts, successorCategories: newSucCat } =
          (await getCategory(id as string))!;
        allProducts.push(...sucProducts);
        queue.push(...newSucCat);
      }

      return res.status(200).json({ success: true, data: allProducts });
    }
  }
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}
