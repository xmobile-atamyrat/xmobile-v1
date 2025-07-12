import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ResponseApi } from '@/pages/lib/types';
import { CURRENCY } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/prices/rate.page.ts';

const CURRENCY_LIST = Object.values(CURRENCY);

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseApi>) {
  addCors(res);
  const { method, userId, query } = req as AuthenticatedRequest;

  if (method !== 'GET') {
    const user = await dbClient.user.findUnique({ where: { id: userId } });
    if (user == null || !['SUPERUSER', 'ADMIN'].includes(user.grade)) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  }

  if (method === 'GET') {
    try {
      const currency = query.currency as CURRENCY;
      if (currency != null) {
        if (!CURRENCY_LIST.includes(currency)) {
          return res.status(400).json({
            success: false,
            message: 'invalid currency',
          });
        }
        const rate = await dbClient.dollarRate.findUnique({
          where: { currency },
        });
        return res.status(200).json({ success: true, data: rate });
      }
      const rates = await dbClient.dollarRate.findMany();
      return res.status(200).json({
        success: true,
        data: rates.map((rate) => ({
          ...rate,
          currency: String(rate.currency),
        })),
      });
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
      const { rate, currency }: { rate: number; currency: CURRENCY } = req.body;
      if (
        rate == null ||
        currency == null ||
        !CURRENCY_LIST.includes(currency)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Currency or rate not provided or invalid currency',
        });
      }
      const result = await dbClient.dollarRate.create({
        data: { currency, rate },
      });

      return res.status(200).json({
        success: true,
        message: 'Dollar rate created',
        data: { ...result, currency: String(result.currency) },
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
      const { rate, currency }: { rate: number; currency: CURRENCY } = req.body;
      if (
        rate == null ||
        currency == null ||
        !CURRENCY_LIST.includes(currency)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Currency or rate not provided or invalid currency',
        });
      }
      const result = await dbClient.dollarRate.upsert({
        where: { currency },
        update: { rate, currency },
        create: { rate, currency },
      });

      let updatedPrices = null;
      if (currency === CURRENCY.TMT) {
        const prices = await dbClient.prices.findMany({
          orderBy: { name: 'asc' },
        });
        updatedPrices = await Promise.all(
          prices.map(({ id, price }) =>
            dbClient.prices.update({
              where: { id },
              data: {
                priceInTmt: Math.ceil(parseFloat(price) * rate).toString(),
              },
            }),
          ),
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Dollar rate updated',
        data: { updatedRate: result, updatedPrices },
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

export default withAuth(handler);
