import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { NextApiResponse } from 'next';

import dbClient from '@/lib/dbClient';
import { ResponseApi } from '@/pages/lib/types';

const filepath = 'src/pages/api/notifications/index.page.ts';

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);

  const { userId, method } = req;

  if (method === 'GET') {
    try {
      const cursorId = req.query.cursorId as string | undefined;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const unreadOnly = req.query.unreadOnly === 'true';

      const whereClause: any = {
        userId,
      };

      if (unreadOnly) {
        whereClause.isRead = false;
      }

      // Cursor pagination: take: limit, skip: 1 (exclude cursor), orderBy deterministic
      const notifications = await dbClient.inAppNotification.findMany({
        take: limit,
        skip: cursorId ? 1 : 0,
        cursor: cursorId ? { id: cursorId } : undefined,
        where: whereClause,
        include: {
          session: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });

      const nextCursor =
        notifications.length === limit && notifications.length > 0
          ? notifications[notifications.length - 1].id
          : undefined;

      return res.status(200).json({
        success: true,
        data: {
          notifications,
          nextCursor,
        },
      });
    } catch (error) {
      console.error(
        filepath,
        `Couldn't fetch notifications for userId: ${userId}. Error: ${error}`,
      );
      return res.status(400).json({ success: false, message: error.message });
    }
  } else {
    console.error(`${filepath}: Method not allowed`);
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }
}

export default withAuth(handler);
