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
      if (grade === 'SUPERUSER' || grade === 'ADMIN') {
        // Admins: see PENDING or THEIR OWN active chats.
        // Superusers: see everything.
        const whereClause =
          grade === 'SUPERUSER'
            ? {}
            : {
                OR: [
                  { status: ChatStatus.PENDING },
                  {
                    status: ChatStatus.ACTIVE,
                    users: { some: { id: userId } },
                  },
                ],
              };

        const allSessions = await dbClient.chatSession.findMany({
          orderBy: { updatedAt: 'desc' },
          where: whereClause,
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                grade: true,
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                senderId: true,
                senderRole: true,
              },
            },
          },
        });

        return res.status(200).json({ success: true, data: allSessions });
      }
      if (grade === 'FREE') {
        const userSessions = await dbClient.chatSession.findMany({
          where: {
            users: { some: { id: userId } },
            status: { in: ['PENDING', 'ACTIVE'] },
          },
          include: {
            users: {
              select: {
                id: true,
                name: true,
                grade: true,
              },
            },
          },
        });

        return res.status(200).json({ success: true, data: userSessions });
      }

      return res.status(403).json({ success: false, message: 'Unauthorized' });
    } catch (error) {
      console.error(
        filepath,
        `Couldn't find session with userId: ${userId}. Error: ${error}`,
      );
      return res.status(400).json({ success: false, message: error.message });
    }
  } else if (method === 'POST') {
    try {
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
            message: 'User already has an active session',
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
            status: { in: ['PENDING', 'ACTIVE'] },
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
        await dbClient.chatSession.update({
          where: { id: sessionId },
          data: { status: chatStatus },
        });
      }

      const session = await dbClient.chatSession.findUnique({
        where: { id: sessionId },
      });

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
}

export default withAuth(handler);
