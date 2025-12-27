import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { NextApiResponse } from 'next';

import dbClient from '@/lib/dbClient';
import { ResponseApi } from '@/pages/lib/types';
import { ChatMessage } from '@prisma/client';

const filepath = 'src/pages/api/chat/message.page.ts';

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);

  const { method } = req;
  if (method === 'PATCH') {
    try {
      const { isRead, content, messageId } = req.body;
      const data: Partial<ChatMessage> = {};
      if (typeof isRead !== 'undefined') data.isRead = isRead;
      if (typeof content !== 'undefined') data.content = content;

      const message = await dbClient.chatMessage.update({
        where: {
          id: messageId,
        },
        data,
      });

      return res.status(200).json({ success: true, data: message });
    } catch (error) {
      console.error(
        filepath,
        `Couldn't update the message; 
        message: ${req.body},
        Error: ${error}`,
      );
      return res.status(400).json({ success: false, message: error.message });
    }
  } else if (method === 'DELETE') {
    try {
      if (req.grade !== 'SUPERUSER') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Only superadmins can delete messages',
        });
      }

      const { messageId } = req.body;
      if (!messageId) {
        return res
          .status(400)
          .json({ success: false, message: 'messageId is required' });
      }

      await dbClient.chatMessage.delete({
        where: { id: messageId },
      });

      return res
        .status(200)
        .json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
      console.error(
        filepath,
        `Couldn't delete the message; 
      messageId: ${req.body?.messageId},
      Error: ${error}`,
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
