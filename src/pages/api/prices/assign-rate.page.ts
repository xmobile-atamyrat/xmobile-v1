import dbClient from '@/lib/dbClient';
import { assignPricesToRate, RateError } from '@/lib/dollarRateService';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ResponseApi } from '@/pages/lib/types';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/prices/assign-rate.page.ts';

// Moving a whole filtered selection onto one rate, rather than a pair per price
// through /api/prices: the figures are re-derived server-side from each price's
// dollars, so a stale table cannot write manat that disagree with the rate.
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseApi>) {
  addCors(res);
  const { method, userId } = req as AuthenticatedRequest;

  if (method !== 'PUT') {
    console.error(`${filepath}: Method not allowed`);
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  const user = await dbClient.user.findUnique({ where: { id: userId } });
  if (user == null || !['SUPERUSER', 'ADMIN'].includes(user.grade)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const { priceIds, rateId } = req.body as {
      priceIds?: string[];
      rateId?: number;
    };

    if (!Array.isArray(priceIds) || rateId == null) {
      return res.status(400).json({
        success: false,
        message: 'priceIds and rateId are required',
      });
    }

    const { updatedCount } = await assignPricesToRate(dbClient, {
      priceIds,
      rateId,
    });

    return res.status(200).json({
      success: true,
      message: 'Prices moved to the rate',
      data: { updatedCount },
    });
  } catch (error) {
    if (error instanceof RateError) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: (error as Error).message });
  }
}

export default withAuth(handler);
