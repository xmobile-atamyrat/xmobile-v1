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
      const sessions = await dbClient.chatSession.findMany({
        where: {
          users: {
            some: {
              id: userId,
            },
          },
        },
      });

      if (grade === 'SUPERUSER') {
        res.status(200).json({ success: true, data: sessions });
      } else if (grade === 'ADMIN') {
        const adminSessions = sessions.filter(
          (session) => session.status !== 'CLOSED',
        );

        res.status(200).json({ success: true, data: adminSessions });
      } else {
        const userSession = sessions.filter((session) => {
          return session.status === 'ACTIVE' || session.status === 'PENDING';
        });

        res.status(200).json({ success: true, data: userSession });
      }
    } catch (error) {
      console.error(
        filepath,
        `Couldn't find session with userId: ${userId}. Error: ${error}`,
      );
      res.status(400).json({ success: false, message: error.message });
    }
  } else if (method === 'POST') {
    try {
      const newSession = await dbClient.chatSession.create({
        data: {
          status: 'PENDING',
          users: {
            connect: {
              id: userId,
            },
          },
        },
      });

      res.status(201).json({ success: true, data: newSession });
    } catch (error) {
      console.error(
        filepath,
        `Couldn't create a session for a userId: ${userId}. Error: ${error}`,
      );
      res.status(400).json({ success: false, message: error.message });
    }
  } else if (method === 'PATCH') {
    try {
      const {
        chatStatus,
        sessionId,
      }: { chatStatus: ChatStatus; sessionId: string } = req.body;
      const session = await dbClient.chatSession.update({
        where: {
          id: sessionId,
        },
        data: {
          status: chatStatus,
        },
      });

      res.status(200).json({ success: true, data: session });
    } catch (error) {
      console.error(
        filepath,
        `Couldn't update status of session`,
        `status: ${req.body?.chatStatus}, sessionId: ${req.body?.sessionId},`,
        `Error: ${error}`,
      );
      res.status(400).json({ success: false, message: error.message });
    }
  } else if (method === 'DELETE') {
    try {
      // todo: only super-user should be allowed for this endpoint
      if (grade !== 'SUPERUSER') {
        return;
      }
      const sessionId = req.body.sessionId;
      await dbClient.chatSession.delete({
        where: {
          id: sessionId,
        },
      });
    } catch (error) {
      console.error(
        filepath,
        `Couldn't delete session. sessionId: ${req.body?.sessionId}. Error: ${error}`,
      );
      res.status(400).json({ success: false, message: error.message });
    }
  } else {
    console.error(`${filepath}: Method not allowed`);
    res.status(405).json({ success: false, message: 'Method not allowed' });
  }
}

export default withAuth(handler);
