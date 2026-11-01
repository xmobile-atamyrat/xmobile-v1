import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import { requireSuperuserBearerAuth } from '@/pages/api/utils/staffAuth';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/notifications/failed.page.ts';
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  addCors(res);

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!(await requireSuperuserBearerAuth(req, res))) return undefined;

  const rawLimit = Number(req.query.limit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

  try {
    const notifications = await dbClient.inAppNotification.findMany({
      where: { deliveryStatus: 'FAILED' },
      orderBy: { lastAttemptAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        content: true,
        retryCount: true,
        lastAttemptAt: true,
        lastError: true,
        createdAt: true,
      },
    });

    return res.status(200).json(notifications);
  } catch (error) {
    console.error(`${filepath} GET:`, error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
