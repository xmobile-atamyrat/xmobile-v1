import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { NextApiResponse } from 'next';

import dbClient from '@/lib/dbClient';
import { ResponseApi } from '@/pages/lib/types';
import { ChatMessage } from '@prisma/client';

const filepath = 'src/pages/api/chat/message.page.ts';
const messagesPerPage = 50;

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);

  const { method } = req;
  if (method === 'GET') {
    try {
      const {
        sessionId,
        cursorMessageId,
      }: { sessionId: string; cursorMessageId: string } = req.body;

      const messages = await dbClient.chatMessage.findMany({
        where: {
          sessionId,
        },
        cursor: {
          id: cursorMessageId,
        },
        skip: 1, // skip the cursor message itself
        take: messagesPerPage,
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.status(200).json({ success: true, data: messages.reverse() });
    } catch (error) {
      console.error(
        filepath,
        `Couldn't fetch the messages; 
        sessionId: ${req.body?.sessionId}, 
        cursorMessageId: ${req.body?.cursorMessageId},
        Error: ${error}`,
      );
      res.status(400).json({ success: false, message: error.message });
    }
  } else if (method === 'PATCH') {
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

      res.status(200).json({ success: true, data: message });
    } catch (error) {
      console.error(
        filepath,
        `Couldn't update the message; 
        message: ${req.body},
        Error: ${error}`,
      );
      res.status(400).json({ success: false, message: error.message });
    }
  } else if (method === 'DELETE') {
    try {
      const { messageId } = req.body;
      if (!messageId) {
        res
          .status(400)
          .json({ success: false, message: 'messageId is required' });
        return;
      }

      await dbClient.chatMessage.delete({
        where: { id: messageId },
      });

      res
        .status(200)
        .json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
      console.error(
        filepath,
        `Couldn't delete the message; 
      messageId: ${req.body?.messageId},
      Error: ${error}`,
      );
      res.status(400).json({ success: false, message: error.message });
    }
  } else {
    console.error(`${filepath}: Method not allowed`);
    res.status(405).json({ success: false, message: 'Method not allowed' });
  }
}

export default withAuth(handler);
