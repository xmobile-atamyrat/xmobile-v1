import { NextApiRequest, NextApiResponse } from 'next';
import { ResponseApi } from '@/pages/lib/types';
import dbClient from '@/lib/dbClient';
import { z } from 'zod';

const filepath = 'src/pages/api/chat.page.ts';

const ChatSchema = z.object({
  userId: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      'Invalid User Id',
    ),
  sessionId: z.string(),
  content: z.string(),
  senderId: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      'Invalid Sender Id',
    ),
  senderRole: z.enum(['ADMIN', 'FREE']),
  isRead: z.boolean(),
  status: z.enum(['open', 'closed', 'resolved']),
});

const GetChatContentSchema = ChatSchema.omit({
  content: true,
  senderId: true,
  isRead: true,
  status: true,
}).extend({ sessionId: z.string().optional() });
const SendMessageSchema = ChatSchema.omit({ userId: true, status: true });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  // const senderRole = z.enum(['ADMIN', 'FREE']).parse(data.senderRole)
  // const userId = z.string().regex(
  //     /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  //     'Invalid User Id').parse(data.userId)
  const data = req.body;

  if (req.method === 'POST') {
    if (data.action === 'getChatContent') {
      if (data.senderRole === 'FREE') {
        try {
          // validate data
          const { userId, sessionId } = GetChatContentSchema.parse({
            userId: data.userId,
            senderRole: data.senderRole,
            sessionId: data.sessionId,
          });
          // if: session id given, else if: find sessionid by userid, else: create session
          const newSessionId =
            sessionId ||
            ((
              await dbClient.chatSession.findFirst({
                where: {
                  userId,
                  status: 'open',
                },
              })
            )?.id ??
              (
                await dbClient.chatSession.create({
                  data: {
                    userId,
                    status: 'open',
                  },
                })
              ).id);

          const content = await dbClient.chatMessage.findMany({
            where: {
              sessionId: newSessionId,
            },
          });

          res.status(200).json({
            success: true,
            data: { sessionId: newSessionId, content },
          });
        } catch (error) {
          if (error instanceof z.ZodError) {
            res.status(400).json({
              success: false,
              data: `${filepath}. ${
                error
              }"Incorrect data types" in getting chat content`,
            });
          } else {
            res.status(500).json({ success: false, data: filepath + error });
          }
        }
      }
    } else if (data.action === 'sendMessage') {
      // res.status(200).json({success: true, data: 'message sent'})
      try {
        // validate data
        const { senderId, senderRole, content, isRead, sessionId } =
          SendMessageSchema.parse({
            senderId: data.senderId,
            senderRole: data.senderRole,
            content: data.content,
            isRead: data.isRead,
            sessionId: data.sessionId,
          });

        await dbClient.chatMessage.create({
          data: {
            senderId,
            senderRole,
            content,
            isRead,
            sessionId,
          },
        });

        res.status(200).json({ success: true, data: 'message sent' });
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            success: false,
            data: `${filepath + error}. "Incorrect data types" in sending message`,
          });
        } else {
          res.status(400).json({ success: false, data: filepath + error });
        }
      }
    }
  } else if (data.method === 'PUT') {
  }
}
