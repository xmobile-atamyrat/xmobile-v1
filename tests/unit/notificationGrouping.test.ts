import { InAppNotification } from '@/pages/lib/types';
import { groupChatNotifications } from '@/pages/lib/notificationGrouping';
import { describe, expect, it } from 'vitest';

function chat(
  id: string,
  sessionId: string,
  isRead = false,
): InAppNotification {
  return {
    id,
    userId: 'u1',
    sessionId,
    type: 'CHAT_MESSAGE',
    content: `msg ${id}`,
    isRead,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function order(id: string, isRead = false): InAppNotification {
  return {
    id,
    userId: 'u1',
    orderId: `o-${id}`,
    type: 'ORDER_STATUS_UPDATE',
    content: `order ${id}`,
    isRead,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('groupChatNotifications', () => {
  it('groups 2+ chats from the same session, keeps lone chats/orders single', () => {
    const rows = groupChatNotifications([
      chat('a1', 's1'),
      order('o1'),
      chat('a2', 's1', true),
      chat('b1', 's2'), // lone session -> stays single
    ]);

    expect(rows.map((r) => r.kind)).toEqual(['group', 'single', 'single']);

    const group = rows[0];
    if (group.kind !== 'group') throw new Error('expected group');
    expect(group.sessionId).toBe('s1');
    expect(group.items.map((i) => i.id)).toEqual(['a1', 'a2']);
    expect(group.latest.id).toBe('a1'); // first-seen is the headline
    expect(group.unread).toBe(1); // a2 is read
  });

  it('preserves first-appearance order and handles no chats', () => {
    const rows = groupChatNotifications([order('o1'), order('o2')]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.kind === 'single')).toBe(true);
  });
});
