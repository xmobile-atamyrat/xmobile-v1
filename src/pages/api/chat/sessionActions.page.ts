import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { NextApiResponse } from 'next';

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

      // Atomic operation: only update if PENDING and no admin exists
      // This prevents race condition where two admins click simultaneously
      const result = await dbClient.chatSession.updateMany({
        where: {
          id: sessionId,
          status: 'PENDING',
          users: {
            none: {
              grade: { in: ['ADMIN', 'SUPERUSER'] },
            },
          },
        },
        data: {
          status: 'ACTIVE',
        },
      });

      // If count = 0, either session doesn't exist, not PENDING, or already has admin
      if (result.count === 0) {
        // Check which case it is for better error message
        const session = await dbClient.chatSession.findUnique({
          where: { id: sessionId },
          include: { users: true },
        });

        if (!session) {
          return res.status(404).json({
            success: false,
            message: 'Session not found',
          });
        }

        // Session exists but update failed = already has admin or not PENDING
        return res.status(409).json({
          success: false,
          message: 'Session unavailable',
        });
      }

      // Update succeeded atomically - safe to add admin
      await dbClient.chatSession.update({
        where: { id: sessionId },
        data: {
          users: {
            connect: { id: userId },
          },
        },
      });

      // TODO Phase 2: Client broadcasts via WebSocket
      // socket.send({ type: 'session_update', sessionId, payload: { status: 'ACTIVE', adminId } })

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error(
        filepath,
        'Failed to add user to session.',
        `userId: ${userId}, sessionId: ${req.body?.sessionId}.`,
        `Error: ${error}`,
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
