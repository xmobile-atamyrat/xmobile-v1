import dbClient from '@/lib/dbClient';
import { getCategory } from '@/pages/api/category.page';
import addCors from '@/pages/api/utils/addCors';
import { computeProductPrice } from '@/pages/api/utils/computeProductPrice';
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

const filepath = 'src/pages/api/product.page.ts';

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
    maxFilesSize: 1024 * 1024 * 10, // 10MB max size
  });
  const promise: Promise<CreateProductReturnType> = new Promise((resolve) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error(filepath, err);
        resolve({ success: false, message: err.message, status: 500 });
      }

      const fileKeys = Object.keys(files);
      const product = await dbClient.product.create({
        data: {
          name: fields.name[0],
          categoryId: fields.categoryId[0],
          description: fields.description?.[0],
          tags: fields.tags ? JSON.parse(fields.tags[0]) : [],
          imgUrls: [
            ...(fields.imageUrls ? JSON.parse(fields.imageUrls[0]) : []),
            ...(fileKeys.map((key) => files[key][0].path) ?? []),
          ],
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
  let product = await dbClient.product.findUnique({
    where: {
      id: productId,
    },
  });
  if (product != null) product = await computeProductPrice(product);
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
    const priceComputedProducts = await Promise.all(
      products.map(async (product) => {
        const data = await computeProductPrice(product);
        return data;
      }),
    );
    return {
      resp: { success: true, data: priceComputedProducts },
      status: 200,
    };
  }
  if (productId != null) {
    const product = await getProduct(productId as string);
    if (product == null) {
      console.error(
        filepath,
        'Product not found',
        `Method: GET`,
        `productId: ${productId}`,
      );
      return {
        resp: { success: false, message: "Couldn't find the product" },
        status: 404,
      };
    }
    return { resp: { success: true, data: product }, status: 200 };
  }
  if (categoryId != null) {
    const category = await getCategory(categoryId as string);
    if (category == null) {
      console.error(
        filepath,
        'Category not found',
        `Method: GET`,
        `productId: ${categoryId}`,
      );
      return {
        resp: { success: false, message: "Couldn't find the category" },
        status: 404,
      };
    }

    const { successorCategories, products } = category;
    if (successorCategories?.length === 0) {
      if (products != null) {
        const priceComputedProducts = await Promise.all(
          products.map(async (product) => {
            const data = await computeProductPrice(product);
            return data;
          }),
        );
        return {
          resp: { success: true, data: priceComputedProducts },
          status: 200,
        };
      }
      return { resp: { success: true, data: products }, status: 200 };
    }

    const queue = successorCategories!;
    const allProducts = products!;
    while (queue.length > 0) {
      const { id } = queue.shift()!;
      const { products: sucProducts, successorCategories: newSucCat } =
        (await getCategory(id as string))!;
      allProducts.push(...sucProducts!);
      queue.push(...newSucCat!);
    }

    const priceComputedProducts = await Promise.all(
      allProducts.map(async (product) => {
        const data = await computeProductPrice(product);
        return data;
      }),
    );
    return {
      resp: { success: true, data: priceComputedProducts },
      status: 200,
    };
  }

  console.error(
    filepath,
    'Neither categoryId nor productId has been provided',
    `Method: GET`,
  );
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
    maxFilesSize: 1024 * 1024 * 10, // 10MB max size
  });
  const promise: Promise<CreateProductReturnType> = new Promise((resolve) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error(filepath, err);
        resolve({ success: false, message: err.message, status: 500 });
      }

      const data: Partial<Product> = { imgUrls: [] };
      if (fields.name?.length > 0) data.name = fields.name[0];
      if (fields.description?.length > 0)
        data.description = fields.description[0];
      if (fields.price?.length > 0) data.price = fields.price[0];
      if (fields.tags?.length > 0) data.tags = JSON.parse(fields.tags[0]);

      const currProduct = await dbClient.product.findUnique({
        where: {
          id: productId as string,
        },
      });
      if (currProduct == null) {
        console.error(
          filepath,
          'Product not found',
          `Method: PUT`,
          `productId: ${productId}`,
        );
        resolve({ success: false, message: 'Product not found', status: 404 });
      }

      const deleteImageUrls = fields.deleteImageUrls
        ? JSON.parse(fields.deleteImageUrls[0])
        : [];
      currProduct?.imgUrls.forEach((imgUrl: string) => {
        if (deleteImageUrls.includes(imgUrl)) {
          if (fs.existsSync(imgUrl)) fs.unlinkSync(imgUrl);
        } else {
          data.imgUrls!.push(imgUrl);
        }
      });

      const fileKeys = Object.keys(files);
      data.imgUrls = [
        ...data.imgUrls!,
        ...(fields.imageUrls ? JSON.parse(fields.imageUrls[0]) : []),
        ...(fileKeys.map((key) => files[key][0].path) ?? []),
      ];

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
  addCors(res);
  const { method, query } = req;
  if (method === 'POST') {
    try {
      const retData = await createProduct(req);
      return res.status(200).json(retData);
    } catch (error) {
      console.error(filepath, error);
      return res
        .status(500)
        .json({ success: false, message: "Couldn't create a new product" });
    }
  } else if (method === 'GET') {
    try {
      const { resp, status } = await handleGetProduct(query);
      return res.status(status).json(resp);
    } catch (error) {
      console.error(filepath, error);
      return {
        resp: { success: false, message: "Couldn't find the product/s" },
        status: 500,
      };
    }
  } else if (method === 'DELETE') {
    try {
      const { productId } = query;
      if (productId == null) {
        console.error(filepath, 'No product id provided', `Method: ${method}`);
        return res
          .status(404)
          .json({ success: false, message: 'No product id provided' });
      }

      const product = await dbClient.product.delete({
        where: {
          id: productId as string,
        },
      });
      if (product == null) {
        console.error(
          filepath,
          'Product not found',
          `Method: ${method}`,
          `productId: ${productId}`,
        );
        return res
          .status(404)
          .json({ success: false, message: "Couldn't find the product" });
      }

      product.imgUrls.forEach((imgUrl: string) => {
        if (fs.existsSync(imgUrl)) fs.unlinkSync(imgUrl);
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error(filepath, error);
      return res
        .status(500)
        .json({ success: false, message: "Couldn't delete the product" });
    }
  } else if (method === 'PUT') {
    const { productId } = query;
    if (productId == null) {
      console.error(filepath, 'No product id provided', `Method: ${method}`);
      return res
        .status(404)
        .json({ success: false, message: 'No product id provided' });
    }

    try {
      const retData = await handleEditProduct(req);
      return res.status(200).json(retData);
    } catch (error) {
      console.error(filepath, error);
      return res
        .status(500)
        .json({ success: false, message: "Couldn't update the product" });
    }
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}
