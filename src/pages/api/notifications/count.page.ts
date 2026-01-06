import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { NextApiResponse } from 'next';

import dbClient from '@/lib/dbClient';
import { ResponseApi } from '@/pages/lib/types';

const filepath = 'src/pages/api/notifications/count.page.ts';

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);

  const { userId, method } = req;

  if (method === 'GET') {
    try {
      const count = await dbClient.inAppNotification.count({
        where: {
          userId,
          isRead: false,
        },
      });

      return res.status(200).json({
        success: true,
        data: { count },
      });
    } catch (error) {
      console.error(
        filepath,
        `Couldn't count unread notifications for userId: ${userId}. Error: ${error}`,
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
