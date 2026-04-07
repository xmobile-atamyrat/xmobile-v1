import dbClient from '@/lib/dbClient';
import { categorySiblingOrderBy } from '@/lib/categoryHierarchy';
import { syncBrandProductCount } from '@/lib/brandProductCount';
import { whereActiveProduct } from '@/lib/prismaActiveScope';
import { getPrice } from '@/pages/api/prices/index.page';
import addCors from '@/pages/api/utils/addCors';
import {
  IMG_COMPRESSION_MAX_QUALITY,
  IMG_COMPRESSION_MIN_QUALITY,
  IMG_COMPRESSION_OPTIONS,
  SORT_OPTIONS,
} from '@/pages/lib/constants';
import { ExtendedProduct, ResponseApi, SortOption } from '@/pages/lib/types';
import { parseName, slugify } from '@/pages/lib/utils';
import { Prisma, Product } from '@prisma/client';
import fs from 'fs';
import multiparty from 'multiparty';
import { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import sharp from 'sharp';

export const config = {
  api: {
    bodyParser: false,
  },
};

const filepath = 'src/pages/api/product/index.page.ts';
const productsPerPage = 20;

interface CreateProductReturnType {
  success: boolean;
  message?: string;
  status: number;
  data?: Product;
}

// changes url from images/products/img -> images/compressed/products/img
export function createCompressedImgUrl(
  imgUrl: string,
  type: 'bad' | 'good',
): string | null {
  // Windows uses '\' in path format, replace it with '/'
  const normalizedUrl = imgUrl.replace(/\\/g, '/');
  const imgName = path.basename(imgUrl);

  if (!normalizedUrl.includes('products/')) {
    console.error(
      filepath,
      "incorrect imgUrl, products folder doesn't exist in image path: ",
      imgUrl,
    );
  }

  return `${process.env.COMPRESSED_PRODUCT_IMAGES_DIR}/${type}/${imgName}`;
}

export async function createCompressedImg(
  imgUrl: string,
  type: 'bad' | 'good',
): Promise<Buffer> | null {
  if (imgUrl != null && fs.existsSync(imgUrl)) {
    try {
      if (
        !fs.existsSync(`${process.env.COMPRESSED_PRODUCT_IMAGES_DIR}/${type}/`)
      ) {
        fs.mkdirSync(`${process.env.COMPRESSED_PRODUCT_IMAGES_DIR}/${type}/`, {
          recursive: true,
        });
      }
      const img = fs.readFileSync(imgUrl);
      let compressedImg: Buffer = img;

      const targetUrl = createCompressedImgUrl(imgUrl, type);
      const targetSize = IMG_COMPRESSION_OPTIONS[type].size;
      const targetWidth =
        IMG_COMPRESSION_OPTIONS[type].width === 0
          ? null
          : IMG_COMPRESSION_OPTIONS[type].width;
      let quality = IMG_COMPRESSION_MAX_QUALITY;

      while (
        compressedImg.length > targetSize &&
        quality > IMG_COMPRESSION_MIN_QUALITY
      ) {
        compressedImg = await sharp(img)
          .resize({ width: targetWidth })
          .jpeg({ quality, progressive: true })
          .toBuffer();
        quality -= 10;
      }
      fs.writeFileSync(targetUrl, new Uint8Array(compressedImg));

      return compressedImg;
    } catch (error) {
      console.error(filepath, 'function createCompressedImg:', error);
      return null;
    }
  } else {
    console.error(filepath, `image not found: ${imgUrl}`);
    return null;
  }
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
        return;
      }

      const fileKeys = Object.keys(files);
      fileKeys.forEach(async (key) => {
        const imgUrl = files[key][0].path;

        await createCompressedImg(imgUrl, 'bad');
        await createCompressedImg(imgUrl, 'good');
      });

      const categoryOk = await dbClient.category.findFirst({
        where: { id: fields.categoryId[0], deletedAt: null },
      });
      if (!categoryOk) {
        resolve({
          success: false,
          message: 'Category not found',
          status: 404,
        });
        return;
      }

      const productEnglishName = parseName(fields.name[0], 'en');
      const productSlug = slugify(productEnglishName);
      if (!productSlug) {
        resolve({
          success: false,
          message: 'Invalid product slug format',
          status: 400,
        });
        return;
      }

      const existingProduct = await dbClient.product.findUnique({
        where: { slug: productSlug },
      });
      if (existingProduct) {
        resolve({
          success: false,
          message: 'duplicateProductError',
          status: 400,
        });
        return;
      }

      const cachedPrice = parseFloat(
        (await getPrice(fields.price?.[0]))?.price ?? '0',
      );
      const product = await dbClient.product.create({
        data: {
          name: fields.name[0],
          slug: productSlug,
          categoryId: fields.categoryId[0],
          brandId: fields.brandId?.[0] || null,
          description: fields.description?.[0],
          tags: fields.tags ? JSON.parse(fields.tags[0]) : [],
          videoUrls: fields.videoUrls ? JSON.parse(fields.videoUrls[0]) : [],
          imgUrls: [
            ...(fields.imageUrls ? JSON.parse(fields.imageUrls[0]) : []),
            ...(fileKeys.map((key) => files[key][0].path) ?? []),
          ],
          price: fields.price?.[0],
          cachedPrice,
        },
      });

      if (product.brandId) {
        await syncBrandProductCount(product.brandId);
      }
      resolve({ success: true, data: product, status: 200 });
    });
  });
  const res = await promise;
  return res;
}

async function getProduct(
  productId?: string,
  productSlug?: string,
): Promise<ExtendedProduct | null> {
  if (!productId && !productSlug) return null;
  const product = await dbClient.product.findFirst({
    where: {
      ...(productSlug ? { slug: productSlug } : { id: productId }),
      deletedAt: null,
    },
    include: { brand: true },
  });

  // product.price = [id]{value}
  const productPrice = await getPrice(product?.price as string);
  if (product) {
    product.price = `${product?.price}{${productPrice?.priceInTmt}}`;
  }

  return product;
}

async function getRecursiveCategoryIds(
  rootId: string,
  visited: Set<string> = new Set(),
): Promise<string[]> {
  if (visited.has(rootId)) return [];
  visited.add(rootId);

  const category = await dbClient.category.findFirst({
    where: { id: rootId, deletedAt: null },
    include: {
      successorCategories: {
        where: { deletedAt: null },
        orderBy: categorySiblingOrderBy,
      },
    },
  });
  if (!category) return [];
  const ids = [rootId];
  if (category.successorCategories) {
    const nestedIds = await Promise.all(
      category.successorCategories.map((sub) =>
        getRecursiveCategoryIds(sub.id, visited),
      ),
    );
    ids.push(...nestedIds.flat());
  }
  return ids;
}

async function handleGetProduct(query: {
  searchKeyword?: string;
  categoryId?: string | string[];
  categoryIds?: string | string[];
  brandIds?: string | string[];
  productId?: string;
  productSlug?: string;
  page?: string;
  minPrice?: string;
  maxPrice?: string;
  sortBy?: SortOption;
}): Promise<{ resp: ResponseApi; status: number }> {
  const {
    searchKeyword,
    productId,
    productSlug,
    categoryId,
    categoryIds,
    brandIds,
    page,
    minPrice,
    maxPrice,
    sortBy,
  } = query;
  const parsedPage = parseInt(page || '1', 10);
  const skip = (parsedPage - 1) * productsPerPage;

  if (
    productId != null &&
    (typeof productId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(productId))
  ) {
    return {
      resp: { success: false, message: 'Invalid product ID format' },
      status: 400,
    };
  }
  if (productSlug != null && typeof productSlug !== 'string') {
    return {
      resp: { success: false, message: 'Invalid product slug format' },
      status: 400,
    };
  }

  if (productId != null || productSlug != null) {
    const product = await getProduct(
      productId as string,
      productSlug as string,
    );

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

  const where: Prisma.ProductWhereInput = { ...whereActiveProduct };

  const categories: string[] = [];
  if (categoryId) {
    if (Array.isArray(categoryId)) categories.push(...categoryId);
    else categories.push(categoryId);
  }
  if (categoryIds) {
    if (Array.isArray(categoryIds)) categories.push(...categoryIds);
    else categories.push(categoryIds);
  }

  if (categories.length > 0) {
    const ids: string[] = [];
    const recursiveIds = await Promise.all(
      categories.map((catId) => getRecursiveCategoryIds(catId)),
    );
    ids.push(...recursiveIds.flat());
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      return { resp: { success: true, data: [] }, status: 200 };
    }
    where.categoryId = { in: uniqueIds };
  }

  if (brandIds) {
    where.brandId = {
      in: Array.isArray(brandIds) ? brandIds : [brandIds],
    };
  }

  if (searchKeyword) {
    where.name = { contains: searchKeyword, mode: 'insensitive' };
  }

  // minPrice/maxPrice are provided in TMT, convert to usd
  if (minPrice || maxPrice) {
    const dollarRate = await dbClient.dollarRate.findFirst({
      where: { currency: 'TMT' },
    });
    const rate = dollarRate?.rate || 1;

    if (minPrice) {
      const minTmt = parseFloat(minPrice);
      if (!Number.isNaN(minTmt)) {
        const currentFilter =
          typeof where.cachedPrice === 'object' ? where.cachedPrice : {};
        where.cachedPrice = { ...currentFilter, gte: minTmt / rate };
      }
    }
    if (maxPrice) {
      const maxTmt = parseFloat(maxPrice);
      if (!Number.isNaN(maxTmt)) {
        const currentFilter =
          typeof where.cachedPrice === 'object' ? where.cachedPrice : {};
        where.cachedPrice = { ...currentFilter, lte: maxTmt / rate };
      }
    }
  }

  let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' }; // default
  if (sortBy) {
    switch (sortBy) {
      case SORT_OPTIONS.PRICE_ASC:
        orderBy = { cachedPrice: 'asc' };
        break;
      case SORT_OPTIONS.PRICE_DESC:
        orderBy = { cachedPrice: 'desc' };
        break;
      case SORT_OPTIONS.A_Z:
        orderBy = { name: 'asc' };
        break;
      case SORT_OPTIONS.NEWEST:
        orderBy = { createdAt: 'desc' };
        break;
      default:
        break;
    }
  }

  const products = await dbClient.product.findMany({
    where,
    orderBy,
    skip,
    take: productsPerPage,
    include: { brand: true },
  });

  const productsWithDisplayPrice = await Promise.all(
    products.map(async (product) => {
      const productPrice = await getPrice(product.price as string);
      if (productPrice) {
        product.price = `${product.price}{${productPrice.priceInTmt}}`;
      }
      return product;
    }),
  );

  return {
    resp: { success: true, data: productsWithDisplayPrice },
    status: 200,
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
      if (fields.categoryId?.[0]) {
        data.categoryId = fields.categoryId[0];
      }
      if (fields.name?.length > 0) {
        data.name = fields.name[0];
      }
      if (fields.description?.length > 0) {
        data.description = fields.description[0];
      }
      if (fields.price?.length > 0) {
        data.price = fields.price[0];
        data.cachedPrice = parseFloat(
          (await getPrice(fields.price[0]))?.price ?? '0',
        );
      }
      if (fields.brandId?.length > 0) {
        data.brandId = fields.brandId[0] || null;
      }
      if (fields.tags?.length > 0) {
        data.tags = JSON.parse(fields.tags[0]);
      }
      if (fields.videoUrls?.length > 0) {
        data.videoUrls = JSON.parse(fields.videoUrls[0]);
      }

      const currProduct = await dbClient.product.findFirst({
        where: {
          id: productId as string,
          deletedAt: null,
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
        return;
      }

      const deleteImageUrls = fields.deleteImageUrls
        ? JSON.parse(fields.deleteImageUrls[0])
        : [];
      currProduct?.imgUrls.forEach((imgUrl: string) => {
        if (deleteImageUrls.includes(imgUrl)) {
          const heavilyCompressedImgUrl = createCompressedImgUrl(imgUrl, 'bad');
          const lightlyCompressedImgUrl = createCompressedImgUrl(
            imgUrl,
            'good',
          );

          if (fs.existsSync(imgUrl)) fs.unlinkSync(imgUrl);
          if (fs.existsSync(heavilyCompressedImgUrl))
            fs.unlinkSync(heavilyCompressedImgUrl);
          if (fs.existsSync(lightlyCompressedImgUrl))
            fs.unlinkSync(lightlyCompressedImgUrl);
        } else {
          data.imgUrls!.push(imgUrl);
        }
      });

      const fileKeys = Object.keys(files);
      fileKeys.forEach(async (key) => {
        const imgUrl = files[key][0].path;
        await createCompressedImg(imgUrl, 'bad');
        await createCompressedImg(imgUrl, 'good');
      });

      data.imgUrls = [
        ...data.imgUrls!,
        ...(fields.imageUrls ? JSON.parse(fields.imageUrls[0]) : []),
        ...(fileKeys.map((key) => files[key][0].path) ?? []),
      ];

      if (data.categoryId) {
        const catOk = await dbClient.category.findFirst({
          where: { id: data.categoryId, deletedAt: null },
        });
        if (!catOk) {
          resolve({
            success: false,
            message: 'Category not found',
            status: 404,
          });
          return;
        }
      }

      const product = await dbClient.product.update({
        where: {
          id: productId as string,
        },
        data,
      });

      if (currProduct.brandId) {
        await syncBrandProductCount(currProduct.brandId);
      }
      if (product.brandId && product.brandId !== currProduct.brandId) {
        await syncBrandProductCount(product.brandId);
      }

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
      return res.status(retData.status).json(retData);
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

      const existing = await dbClient.product.findFirst({
        where: { id: productId as string, deletedAt: null },
        select: { id: true, brandId: true },
      });

      if (!existing) {
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

      const now = new Date();
      await dbClient.$transaction([
        dbClient.product.update({
          where: { id: existing.id },
          data: { deletedAt: now },
        }),
        dbClient.cartItem.deleteMany({ where: { productId: existing.id } }),
      ]);

      if (existing.brandId) {
        await syncBrandProductCount(existing.brandId);
      }

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
      return res.status(retData.status).json(retData);
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
