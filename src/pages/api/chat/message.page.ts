import { NextApiResponse } from 'next';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';

import dbClient from '@/lib/dbClient';
import { ResponseApi } from '@/pages/lib/types';
import { z, ZodError } from 'zod';
import { UserRole } from '@prisma/client';

const filepath = 'src/pages/api/chat/message.page.ts';

const MessageSchema = z
  .object({
    sessionId: z.string(),
    senderId: z.string(),
    senderRole: z.enum([UserRole.ADMIN, UserRole.FREE, UserRole.SUPERUSER]),
    content: z.string(),
    isRead: z.boolean(),
  })
  .strict();

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);

  const data = req;
  if (req.method === 'POST') {
    try {
      const { senderId, senderRole, isRead, content, sessionId } =
        MessageSchema.parse(data.body);
      const message = await dbClient.chatMessage.create({
        data: {
          senderId,
          isRead,
          content,
          senderRole,
          sessionId,
        },
      });

      res.status(200).json({ success: true, data: message });
    } catch (error) {
      if (error instanceof ZodError) {
        console.error(filepath, 'InvalidMessageFormat:', error);

        res.status(400).json({ success: false, message: error.message });
      } else {
        console.error(filepath, error);

        res.status(500).json({ success: false, message: error });
      }
    }
  }
}

export default withAuth(handler);
