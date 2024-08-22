import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import { ResponseApi } from '@/pages/lib/types';
import { Prices } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';

const filepath = 'src/pages/api/prices/addIds.page.ts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);
  const { method } = req;

  if (method === 'POST') {
    try {
      const prices: Prices[] = await dbClient.prices.findMany();

      await Promise.all(
        prices.map(async ({ id, name }) => {
          if (id == null) {
            const newId = uuidv4();
            await dbClient.prices.update({
              where: { name },
              data: { id: newId },
            });
          }
        }),
      );

      return res.status(200).json({
        success: true,
        message: 'Added ids to prices',
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
