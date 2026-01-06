import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { NextApiResponse } from 'next';

import dbClient from '@/lib/dbClient';
import { ResponseApi } from '@/pages/lib/types';

const filepath = 'src/pages/api/notifications/mark-read.page.ts';

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);

  const { userId, method } = req;

  if (method === 'PATCH' || method === 'POST') {
    try {
      const { notificationIds, notificationId, sessionId } = req.body;

      // Support both single notificationId and array of notificationIds
      let idsToUpdate: string[] = [];

      if (notificationIds && Array.isArray(notificationIds)) {
        idsToUpdate = notificationIds;
      } else if (notificationId) {
        idsToUpdate = [notificationId];
      } else if (sessionId) {
        // Mark all notifications for a session as read
        const sessionNotifications = await dbClient.inAppNotification.findMany({
          where: {
            userId,
            sessionId,
            isRead: false,
          },
          select: { id: true },
        });
        idsToUpdate = sessionNotifications.map((n) => n.id);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Missing notificationIds, notificationId, or sessionId',
        });
      }

      if (idsToUpdate.length === 0) {
        return res.status(200).json({
          success: true,
          data: { updated: 0 },
        });
      }

      // Verify all notifications belong to this user
      const notifications = await dbClient.inAppNotification.findMany({
        where: {
          id: { in: idsToUpdate },
          userId,
        },
      });

      if (notifications.length !== idsToUpdate.length) {
        return res.status(403).json({
          success: false,
          message: 'Some notifications not found or do not belong to user',
        });
      }

      // Mark notifications as read
      const result = await dbClient.inAppNotification.updateMany({
        where: {
          id: { in: idsToUpdate },
          userId,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return res.status(200).json({
        success: true,
        data: { updated: result.count },
      });
    } catch (error) {
      console.error(
        filepath,
        `Couldn't mark notifications as read for userId: ${userId}. Error: ${error}`,
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
