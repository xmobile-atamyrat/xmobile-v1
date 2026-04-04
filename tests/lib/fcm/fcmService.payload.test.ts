import { NotificationType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { createFCMNotificationPayload } from '@/lib/fcm/fcmService';

describe('createFCMNotificationPayload', () => {
  const base = {
    id: 'n1',
    type: NotificationType.CHAT_MESSAGE,
    title: 'Hi',
    content: 'Body text',
  };

  it('defaults click to /chat and title fallback', () => {
    const p = createFCMNotificationPayload(
      { ...base, sessionId: null },
      'https://app.example',
    );
    expect(p.title).toBe('Hi');
    expect(p.body).toBe('Body text');
    expect(p.data.click_action).toBe('https://app.example/chat');
  });

  it('adds sessionId to click_action for chat', () => {
    const p = createFCMNotificationPayload(
      { ...base, sessionId: 'sess-9' },
      'https://app.example',
    );
    expect(p.data.click_action).toBe(
      'https://app.example/chat?sessionId=sess-9',
    );
    expect(p.data.sessionId).toBe('sess-9');
  });

  it('routes order updates to /orders/:id', () => {
    const p = createFCMNotificationPayload(
      {
        id: 'n2',
        type: NotificationType.ORDER_STATUS_UPDATE,
        content: 'Status',
        orderId: 'ord-1',
      },
      'https://x.example',
    );
    expect(p.data.click_action).toBe('https://x.example/orders/ord-1');
    expect(p.data.orderId).toBe('ord-1');
  });
});
