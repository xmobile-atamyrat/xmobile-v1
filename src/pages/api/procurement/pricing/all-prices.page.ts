import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/procurement/pricing/all-prices.page.ts';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  addCors(res);
  const { userId, method } = req as AuthenticatedRequest;
  const user = await dbClient.user.findUnique({
    where: { id: userId },
  });
  if (!user || user.grade !== 'SUPERUSER') {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    if (method === 'GET') {
      // Get all products with their associated prices (if any)
      const allProducts = await dbClient.procurementProduct.findMany({
        include: {
          productPrice: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      // Transform to match the expected frontend interface
      const productPricesData = allProducts.map((product) => ({
        id: product.productPrice?.id || null,
        productId: product.id,
        product: {
          id: product.id,
          name: product.name,
        },
        originalPrice: product.productPrice?.originalPrice || null,
        originalCurrency: product.productPrice?.originalCurrency || null,
        bulkPrice: product.productPrice?.bulkPrice || null,
        singlePrice: product.productPrice?.singlePrice || null,
        lastUpdatedFromOrderId:
          product.productPrice?.lastUpdatedFromOrderId || null,
        lastUpdatedFromProductId:
          product.productPrice?.lastUpdatedFromProductId || null,
        createdAt: product.productPrice?.createdAt || null,
        updatedAt: product.productPrice?.updatedAt || null,
      }));

      return res.status(200).json({
        success: true,
        data: productPricesData,
      });
    }

    if (method === 'POST') {
      const {
        productId,
        originalPrice,
        originalCurrency,
        bulkPrice,
        singlePrice,
        lastUpdatedFromOrderId,
        lastUpdatedFromProductId,
      } = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required',
        });
      }

      const productPrice = await dbClient.productPrice.upsert({
        where: {
          productId,
        },
        update: {
          originalPrice,
          originalCurrency,
          bulkPrice,
          singlePrice,
          lastUpdatedFromOrderId,
          lastUpdatedFromProductId,
        },
        create: {
          productId,
          originalPrice,
          originalCurrency,
          bulkPrice,
          singlePrice,
          lastUpdatedFromOrderId,
          lastUpdatedFromProductId,
        },
        include: {
          product: true,
        },
      });

      return res.status(200).json({
        success: true,
        data: productPrice,
      });
    }

    if (method === 'PUT') {
      const { id, originalPrice, originalCurrency, bulkPrice, singlePrice } =
        req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Price ID is required',
        });
      }

      const updatedPrice = await dbClient.productPrice.update({
        where: { id },
        data: {
          originalPrice,
          originalCurrency,
          bulkPrice,
          singlePrice,
        },
        include: {
          product: true,
        },
      });

      return res.status(200).json({
        success: true,
        data: updatedPrice,
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message,
    });
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}

export default withAuth(handler);
