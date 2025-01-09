// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import { ResponseApi } from '@/pages/lib/types';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/prices/rate.page.ts';
const index = 1;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);
  const { method } = req;
  if (method === 'GET') {
    try {
      const rate = await dbClient.dollarRate.findUnique({
        where: { id: index },
      });
      return res.status(200).json({ success: true, data: rate });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  }
  if (method === 'POST') {
    try {
      const { rate }: { rate: number } = JSON.parse(req.body);
      if (rate == null) {
        return res.status(400).json({
          success: false,
          message: 'No data provided',
        });
      }
      const result = await dbClient.dollarRate.create({
        data: { id: index, rate },
      });

      return res.status(200).json({
        success: true,
        message: 'Dollar rate created',
        data: result,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  }
  if (method === 'PUT') {
    try {
      const { rate }: { rate: number } = JSON.parse(req.body);
      if (rate == null) {
        return res.status(400).json({
          success: false,
          message: 'No data provided',
        });
      }
      await dbClient.dollarRate.upsert({
        where: { id: index },
        update: { rate },
        create: { id: index, rate },
      });

      const prices = await dbClient.prices.findMany({
        orderBy: { name: 'asc' },
      });
      const result = await Promise.all(
        prices.map(({ id, price }) =>
          dbClient.prices.update({
            where: { id },
            data: {
              priceInTmt: Math.ceil(parseFloat(price) * rate).toString(),
            },
          }),
        ),
      );

      return res.status(200).json({
        success: true,
        message: 'Dollar rate updated',
        data: result,
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
