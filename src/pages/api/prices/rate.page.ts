import dbClient from '@/lib/dbClient';
import {
  createRate,
  deleteRate,
  RateError,
  updateRate,
} from '@/lib/dollarRateService';
import { findDefaultRate } from '@/lib/dollarRates';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ResponseApi } from '@/pages/lib/types';
import { CURRENCY } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/prices/rate.page.ts';

const CURRENCY_LIST = Object.values(CURRENCY);

const fail = (res: NextApiResponse<ResponseApi>, error: unknown) => {
  if (error instanceof RateError) {
    return res
      .status(error.status)
      .json({ success: false, message: error.message });
  }
  console.error(error);
  return res
    .status(500)
    .json({ success: false, message: (error as Error).message });
};

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
        // Several TMT rates can now share a currency; the default is the one
        // callers asking by currency mean.
        const rates = await dbClient.dollarRate.findMany({
          where: { currency },
        });
        const rate = findDefaultRate(rates) ?? rates[0] ?? null;
        return res.status(200).json({ success: true, data: rate });
      }
      const rates = await dbClient.dollarRate.findMany({
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });
      return res.status(200).json({
        success: true,
        data: rates.map((rate) => ({
          ...rate,
          currency: String(rate.currency),
        })),
      });
    } catch (error) {
      return fail(res, error);
    }
  }

  if (method === 'POST') {
    try {
      const { rate, currency, name } = req.body as {
        rate: number;
        currency?: CURRENCY;
        name?: string;
      };

      // A name means a manat price rate. Procurement still creates its
      // AED/CNY/USD rows by currency alone.
      if (name != null) {
        const created = await createRate(dbClient, { name, rate });
        return res.status(200).json({
          success: true,
          message: 'Dollar rate created',
          data: { ...created, currency: String(created.currency) },
        });
      }

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
      return fail(res, error);
    }
  }

  if (method === 'PUT') {
    try {
      const { id, rate, currency, name } = req.body as {
        id?: number;
        rate: number;
        currency?: CURRENCY;
        name?: string;
      };

      // Price rates are addressed by id, because the currency no longer picks
      // out a single row.
      if (id != null) {
        const { rate: updated, updatedCount } = await updateRate(dbClient, {
          id,
          rate,
          name,
        });
        return res.status(200).json({
          success: true,
          message: 'Dollar rate updated',
          data: {
            updatedRate: { ...updated, currency: String(updated.currency) },
            updatedCount,
          },
        });
      }

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

      // Addressing TMT by currency means the default price rate, which keeps
      // every price it governs in step.
      if (currency === CURRENCY.TMT) {
        const existing = findDefaultRate(
          await dbClient.dollarRate.findMany({ where: { currency } }),
        );
        if (existing == null) {
          throw new RateError('There is no default rate to update', 404);
        }
        const { rate: updated, updatedCount } = await updateRate(dbClient, {
          id: existing.id,
          rate,
        });
        return res.status(200).json({
          success: true,
          message: 'Dollar rate updated',
          data: {
            updatedRate: { ...updated, currency: String(updated.currency) },
            updatedCount,
          },
        });
      }

      const existing = await dbClient.dollarRate.findFirst({
        where: { currency },
      });
      const result =
        existing == null
          ? await dbClient.dollarRate.create({ data: { currency, rate } })
          : await dbClient.dollarRate.update({
              where: { id: existing.id },
              data: { rate },
            });

      return res.status(200).json({
        success: true,
        message: 'Dollar rate updated',
        data: { updatedRate: result, updatedPrices: null },
      });
    } catch (error) {
      return fail(res, error);
    }
  }

  if (method === 'DELETE') {
    try {
      const { id } = req.body as { id?: number };
      if (id == null) {
        return res
          .status(400)
          .json({ success: false, message: 'Rate id not provided' });
      }
      const { reassignedCount } = await deleteRate(dbClient, id);
      return res.status(200).json({
        success: true,
        message: 'Dollar rate deleted',
        data: { reassignedCount },
      });
    } catch (error) {
      return fail(res, error);
    }
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}

export default withAuth(handler);
