import { UserRole } from '@prisma/client';
import { z } from 'zod';

export const MessageSchema = z.object({
  tempId: z.string().optional(),
  sessionId: z.string(),
  senderId: z.string(),
  senderRole: z.enum([UserRole.ADMIN, UserRole.FREE, UserRole.SUPERUSER]),
  content: z.string().max(5000),
  timestamp: z.string(),
});

export const GetMessagesSchema = z.object({
  type: z.literal('get_messages'),
  sessionId: z.string(),
  cursorId: z.string().optional(),
});

export const MarkNotificationReadSchema = z.object({
  type: z.literal('mark_notification_read'),
  notificationIds: z.array(z.string()),
});
