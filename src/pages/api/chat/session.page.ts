import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { NextApiResponse } from 'next';

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

        return res.status(200).json({ success: true, data: adminSessions });
      } else {
        const userSession = sessions.filter((session) => {
          return session.status === 'ACTIVE' || session.status === 'PENDING';
        });

        return res.status(200).json({ success: true, data: userSession });
      }
    } catch (error) {
      console.error(
        filepath,
        `Couldn't find session with userId: ${userId}. Error: ${error}`,
      );
      return res.status(400).json({ success: false, message: error.message });
    }
  } else if (method === 'POST') {
    try {
      // Check if user already has an active or pending session
      if (grade === 'FREE') {
        const existingSession = await dbClient.chatSession.findFirst({
          where: {
            users: { some: { id: userId } },
            status: { in: ['PENDING', 'ACTIVE'] },
          },
        });

        if (existingSession) {
          return res.status(409).json({
            success: false,
            message: 'You already have an active session',
            data: existingSession,
          });
        }

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

        // TODO Phase 2: Client broadcasts via WebSocket after HTTP success
        // Example: socket.send({ type: 'new_session', sessionId, payload: {...} })
        // Will be handled by generic relay in WS server

        return res.status(201).json({ success: true, data: newSession });
      }

      return res.status(403).json({
        success: false,
        message: 'Only regular users can create sessions',
      });
    } catch (error) {
      console.error(
        filepath,
        `Couldn't create a session for a userId: ${userId}. Error: ${error}`,
      );
      return res.status(400).json({ success: false, message: error.message });
    }
  } else if (method === 'PATCH') {
    try {
      const {
        chatStatus,
        sessionId,
      }: { chatStatus: ChatStatus; sessionId: string } = req.body;

      // For CLOSED status, use atomic check to prevent conflicts
      if (chatStatus === 'CLOSED') {
        const result = await dbClient.chatSession.updateMany({
          where: {
            id: sessionId,
            status: { in: ['PENDING', 'ACTIVE'] }, // Only if not already closed
          },
          data: {
            status: 'CLOSED',
          },
        });

        if (result.count === 0) {
          return res.status(409).json({
            success: false,
            message: 'Session already closed or not found',
          });
        }
      } else {
        // For other status changes, just update normally
        await dbClient.chatSession.update({
          where: { id: sessionId },
          data: { status: chatStatus },
        });
      }

      // Fetch updated session to return
      const session = await dbClient.chatSession.findUnique({
        where: { id: sessionId },
      });

      // TODO Phase 2: Client broadcasts via WebSocket after HTTP success
      // Example: socket.send({ type: 'session_update', sessionId, payload: { status } })

      return res.status(200).json({ success: true, data: session });
    } catch (error) {
      console.error(
        filepath,
        `Couldn't update status of session`,
        `status: ${req.body?.chatStatus}, sessionId: ${req.body?.sessionId},`,
        `Error: ${error}`,
      );
      return res.status(400).json({ success: false, message: error.message });
    }
  } else if (method === 'DELETE') {
    try {
      // todo: only super-user should be allowed for this endpoint
      if (grade !== 'SUPERUSER') {
        return res
          .status(403)
          .json({ success: false, message: 'Unauthorized' });
      }
      const sessionId = req.body.sessionId;
      await dbClient.chatSession.delete({
        where: {
          id: sessionId,
        },
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error(
        filepath,
        `Couldn't delete session. sessionId: ${req.body?.sessionId}. Error: ${error}`,
      );
      return res.status(400).json({ success: false, message: error.message });
    }
  } else {
    console.error(`${filepath}: Method not allowed`);
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }
  return undefined;
}

export default withAuth(handler);
