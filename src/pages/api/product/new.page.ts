import dbClient from '@/lib/dbClient';
import { getPrice } from '@/pages/api/prices/index.page';
import addCors from '@/pages/api/utils/addCors';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/product/new.page.ts';
const productsPerPage = 20;

async function handleGetNewProducts(query: {
  searchKeyword?: string;
  page?: string;
}): Promise<{ resp: ResponseApi; status: number }> {
  const { searchKeyword, page } = query;
  const parsedPage = parseInt(page || '1', 10);
  const skip = (parsedPage - 1) * productsPerPage;

  try {
    // Build the where clause for search filtering
    const where = searchKeyword
      ? {
          name: {
            contains: searchKeyword,
            mode: 'insensitive' as const,
          },
        }
      : {};

    // Fetch products with database-level pagination
    const products = await dbClient.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: productsPerPage,
    });

    // Resolve prices for all products
    const productsWithPrices = await Promise.all(
      products.map(async (product) => {
        const productPrice = await getPrice(product?.price as string);
        product.price = `${product?.price}{${productPrice?.priceInTmt}}`;
        return product;
      }),
    );

    return {
      resp: {
        success: true,
        data: productsWithPrices,
      },
      status: 200,
    };
  } catch (error) {
    console.error(filepath, 'Error fetching new products:', error);
    return {
      resp: {
        success: false,
        message: "Couldn't fetch new products",
      },
      status: 500,
    };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);
  const { method, query } = req;

  if (method === 'GET') {
    try {
      const { resp, status } = await handleGetNewProducts(query);
      return res.status(status).json(resp);
    } catch (error) {
      console.error(filepath, error);
      return res.status(500).json({
        success: false,
        message: "Couldn't fetch new products",
      });
    }
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}
