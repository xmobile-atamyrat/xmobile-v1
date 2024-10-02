// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import { ResponseApi } from '@/pages/lib/types';
import { Prices } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/prices/index.page.ts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);
  const { method } = req;
  if (method === 'POST') {
    try {
      const body: Partial<Prices> = JSON.parse(req.body);
      if (body == null) {
        return res.status(400).json({
          success: false,
          message: 'No data provided',
        });
      }

      const { name, price, priceInTmt } = body;
      if (name == null || price == null || priceInTmt == null) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
      }
      const newPrice = await dbClient.prices.create({
        data: {
          name,
          price,
          priceInTmt,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Prices updated',
        data: newPrice,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  } else if (method === 'GET') {
    try {
      const { id, searchKeyword } = req.query;
      if (id != null) {
        const price = await dbClient.prices.findUnique({
          where: { id: id as string },
        });
        return res.status(200).json({ success: true, data: price });
      }
      if (searchKeyword != null) {
        const prices = await dbClient.prices.findMany({
          where: {
            OR: [
              {
                name: {
                  contains: searchKeyword as string,
                  mode: 'insensitive',
                },
              },
              {
                price: {
                  contains: searchKeyword as string,
                  mode: 'insensitive',
                },
              },
              {
                priceInTmt: {
                  contains: searchKeyword as string,
                  mode: 'insensitive',
                },
              },
            ],
          },
        });
        return res.status(200).json({ success: true, data: prices });
      }
      const prices = await dbClient.prices.findMany({
        orderBy: { name: 'asc' },
      });
      return res.status(200).json({ success: true, data: prices });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  } else if (method === 'PUT') {
    try {
      const { pricePairs }: { pricePairs: Partial<Prices>[] } = JSON.parse(
        req.body,
      );
      if (pricePairs == null) {
        return res.status(400).json({
          success: false,
          message: 'No data provided',
        });
      }

      await Promise.all(
        pricePairs.map(async (price) => {
          const data: any = { name: price.name };
          if (price.price != null) {
            data.price = price.price;
          }
          if (price.priceInTmt != null) {
            data.priceInTmt = price.priceInTmt;
          }
          const updatedPrice = await dbClient.prices.update({
            where: { id: price.id },
            data,
          });
          return updatedPrice;
        }),
      );

      return res.status(200).json({
        success: true,
        message: 'Prices updated',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  } else if (method === 'DELETE') {
    try {
      const { id } = req.query;
      if (id == null) {
        return res.status(400).json({
          success: false,
          message: 'No product name provided',
        });
      }
      const deletedPrice = await dbClient.prices.delete({
        where: { id: id as string },
      });
      return res.status(200).json({
        success: true,
        message: 'Price deleted',
        data: deletedPrice,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}
