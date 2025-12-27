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
    try {
      const { sessionId }: { sessionId: string } = req.body;

      // Hybrid Transaction Pattern:
      // 1. ATOMIC LOCK: updateMany allows filtering by relations (users: { none: ADMIN }).
      //    Standard update cannot filter by relations, so it cannot atomically check "Is this unassigned?".
      // 2. CONSISTENCY: $transaction ensures if "Add User" fails, the status change rolls back.
      const updatedSession = await dbClient.$transaction(async (tx) => {
        const result = await tx.chatSession.updateMany({
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

        if (result.count === 0) {
          throw new Error('Session unavailable');
        }

        return tx.chatSession.update({
          where: { id: sessionId },
          data: {
            users: {
              connect: { id: userId },
            },
          },
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                grade: true,
              },
            },
          },
        });
      });

      return res.status(200).json({ success: true, data: updatedSession });
    } catch (error) {
      console.error(
        filepath,
        'Failed to add user to session.',
        `userId: ${userId}, sessionId: ${req.body?.sessionId}.`,
        `Error: ${error}`,
      );

      return res
        .status(400)
        .json({ success: false, message: 'Failed to join session' });
    }
  } else {
    console.error(`${filepath}: Method not allowed`);
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }
}

export default withAuth(handler);
