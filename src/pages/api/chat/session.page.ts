import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { NextApiResponse } from 'next';

import dbClient from '@/lib/dbClient';
import { sendFCMWithCallbackFallback } from '@/lib/fcm/fcmService';
import { ResponseApi } from '@/pages/lib/types';
import { ChatStatus } from '@prisma/client';
import {
  createNotificationsForSessionRequest,
  sendNotificationToWebSocketServer,
} from '@/ws-server/lib/utils';

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
        const allSessions = await dbClient.chatSession.findMany({
          orderBy: { updatedAt: 'desc' },
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
            status: 'ACTIVE',
            users: {
              connect: {
                id: userId,
              },
            },
          },
        });

        try {
          const notifications = await createNotificationsForSessionRequest(
            newSession.id,
          );
          const notificationPromises = notifications.map((notification) =>
            sendFCMWithCallbackFallback(
              notification.userId,
              notification,
              sendNotificationToWebSocketServer,
            ).catch((error) => {
              console.error(
                filepath,
                `Failed to send notification to user ${notification.userId}:`,
                error,
              );
            }),
          );
          await Promise.allSettled(notificationPromises);
        } catch (error) {
          console.error(
            filepath,
            'Failed to create/send notifications for session request:',
            error,
          );
        }

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

      const existingSession = await dbClient.chatSession.findUnique({
        where: { id: sessionId },
        include: { users: { select: { id: true } } },
      });

      if (!existingSession) {
        return res.status(404).json({
          success: false,
          message: 'Session not found',
        });
      }

      if (grade === 'FREE') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Only admins can change session status',
        });
      }

      const updateResult = await dbClient.chatSession.updateMany({
        where:
          chatStatus === 'CLOSED'
            ? { id: sessionId } // closing: always allow for UX
            : { id: sessionId, status: { not: 'CLOSED' } }, // reopening: block if closed
        data: {
          status: chatStatus,
        },
      });

      if (updateResult.count === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot change status of a closed session',
        });
      }

      const updatedSession = await dbClient.chatSession.findUnique({
        where: { id: sessionId },
      });

      return res.status(200).json({ success: true, data: updatedSession });
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
