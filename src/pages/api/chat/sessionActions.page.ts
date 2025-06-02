import { NextApiResponse } from 'next';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';

import dbClient from '@/lib/dbClient';
import { ResponseApi } from '@/pages/lib/types';

const filepath = 'src/pages/api/chat/sessionActions.page.ts';

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);

  const { userId, method } = req;
  if (method === 'POST') {
    // add user to session
    try {
      const { sessionId }: { sessionId: string } = req.body;

      await dbClient.chatSession.update({
        where: {
          id: sessionId,
        },
        data: {
          users: {
            connect: {
              id: userId,
            },
          },
        },
      });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error(
        filepath,
        'Failed to add user to session.',
        `userId: ${userId}, sessionId: ${req.body?.sessionId}.`,
        `Error: ${error}`,
      );
      res.status(400).json({ success: false, message: error.message });
    }
  } else if (method === 'DELETE') {
    // remove user from session
    try {
      const { sessionId }: { sessionId: string } = req.body;
      await dbClient.chatSession.update({
        where: {
          id: sessionId,
        },
        data: {
          users: {
            disconnect: {
              id: userId,
            },
          },
        },
      });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error(
        filepath,
        'Failed to delete user from session.',
        `userId: ${userId}, sessionId: ${req.body?.sessionId}.`,
        `Error: ${error}`,
      );
      res.status(400).json({ success: false, message: error.message });
    }
  } else {
    console.error(`${filepath}: Method not allowed`);
    res.status(405).json({ success: false, message: 'Method not allowed' });
  }
}

export default withAuth(handler);
