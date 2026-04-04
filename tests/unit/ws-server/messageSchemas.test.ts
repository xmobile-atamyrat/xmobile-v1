import { UserRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  GetMessagesSchema,
  MarkNotificationReadSchema,
  MessageSchema,
} from '@/ws-server/messageSchemas';

describe('MessageSchema', () => {
  it('parses a valid chat payload', () => {
    const parsed = MessageSchema.parse({
      tempId: 't1',
      sessionId: 'sess-1',
      senderId: 'user-1',
      senderRole: UserRole.FREE,
      content: 'Hello',
      timestamp: new Date().toISOString(),
    });
    expect(parsed.sessionId).toBe('sess-1');
    expect(parsed.tempId).toBe('t1');
  });

  it('allows omitting tempId', () => {
    const parsed = MessageSchema.parse({
      sessionId: 's',
      senderId: 'u',
      senderRole: UserRole.ADMIN,
      content: 'x',
      timestamp: 't',
    });
    expect(parsed.tempId).toBeUndefined();
  });

  it('rejects content over 5000 chars', () => {
    const r = MessageSchema.safeParse({
      sessionId: 's',
      senderId: 'u',
      senderRole: UserRole.SUPERUSER,
      content: 'a'.repeat(5001),
      timestamp: 't',
    });
    expect(r.success).toBe(false);
  });

  it('rejects invalid senderRole', () => {
    const r = MessageSchema.safeParse({
      sessionId: 's',
      senderId: 'u',
      senderRole: 'GUEST',
      content: 'hi',
      timestamp: 't',
    });
    expect(r.success).toBe(false);
  });
});

describe('GetMessagesSchema', () => {
  it('requires type get_messages and sessionId', () => {
    expect(
      GetMessagesSchema.parse({
        type: 'get_messages',
        sessionId: 'abc',
      }).sessionId,
    ).toBe('abc');
  });

  it('rejects wrong literal type', () => {
    expect(
      GetMessagesSchema.safeParse({
        type: 'message',
        sessionId: 'x',
      }).success,
    ).toBe(false);
  });
});

describe('MarkNotificationReadSchema', () => {
  it('parses notification ids array', () => {
    const parsed = MarkNotificationReadSchema.parse({
      type: 'mark_notification_read',
      notificationIds: ['n1', 'n2'],
    });
    expect(parsed.notificationIds).toEqual(['n1', 'n2']);
  });
});
