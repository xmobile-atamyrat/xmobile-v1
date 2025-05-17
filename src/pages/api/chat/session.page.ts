import { NextApiResponse } from 'next';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';

import dbClient from '@/lib/dbClient';
import { ResponseApi } from '@/pages/lib/types';
import { ChatStatus } from '@prisma/client';

const filepath = 'src/pages/api/chat/session.page.ts';

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);

  const { userId, grade, method } = req;
  if (method === 'GET') {
    try {
      const { chatSessions } = await dbClient.user.findUnique({
        where: {
          id: userId,
        },
        select: { chatSessions: true },
      });
      if (!chatSessions) {
        console.error(
          filepath,
          `User doesn't exist or not found, userId: ${userId}`,
        );
        res.status(404).json({ success: false, message: 'User was not found' });
        return;
      }

      if (grade === 'SUPERUSER') {
        res.status(200).json({ success: true, data: [chatSessions] });
      } else if (grade === 'ADMIN') {
        const adminSessions = chatSessions.filter(
          (chatSession) => chatSession.status !== 'CLOSED',
        );
        res.status(200).json({ success: true, data: [adminSessions] });
      } else {
        const userSession = chatSessions.filter(
          (chatSession) =>
            chatSession.status === 'ACTIVE' || chatSession.status === 'PENDING',
        );

        if (!userSession.length) {
          const newSession = await dbClient.chatSession.create({
            data: {
              users: {
                connect: {
                  id: userId,
                },
              },
            },
          });

          res.status(200).json({ success: true, data: [newSession] });
          return;
        }
        res.status(200).json({ success: true, data: [userSession] });
      }
    } catch (error) {
      console.error(filepath, error);
      res.status(400).json({ success: false, message: error.message });
    }
  } else if (method === 'POST') {
    // add user to session
    try {
      const { sessionId, status }: { sessionId: string; status: ChatStatus } =
        req.body;

      await dbClient.chatSession.update({
        where: {
          id: sessionId,
        },
        data: {
          status,
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
      const { sessionId, status }: { sessionId: string; status: ChatStatus } =
        req.body;
      await dbClient.chatSession.update({
        where: {
          id: sessionId,
        },
        data: {
          status,
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
