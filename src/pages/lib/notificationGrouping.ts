import { InAppNotification } from '@/pages/lib/types';

export type NotificationRow =
  | { kind: 'single'; notification: InAppNotification }
  | {
      kind: 'group';
      sessionId: string;
      items: InAppNotification[];
      latest: InAppNotification;
      unread: number;
    };

/**
 * Collapse chat notifications that share a sessionId into a single
 * WhatsApp-style group (2+ messages), preserving the input order by each
 * session's first appearance. Order notifications and single-message
 * sessions stay as plain rows. Pure — no React, so it is unit-testable.
 */
export function groupChatNotifications(
  notifications: InAppNotification[],
): NotificationRow[] {
  const sessionItems = new Map<string, InAppNotification[]>();
  const order: Array<{ single: InAppNotification } | { sessionId: string }> =
    [];
  const seen = new Set<string>();

  notifications.forEach((n) => {
    if (n.type === 'CHAT_MESSAGE' && n.sessionId) {
      const sid = n.sessionId;
      const bucket = sessionItems.get(sid);
      if (bucket) {
        bucket.push(n);
      } else {
        sessionItems.set(sid, [n]);
      }
      if (!seen.has(sid)) {
        seen.add(sid);
        order.push({ sessionId: sid });
      }
    } else {
      order.push({ single: n });
    }
  });

  return order.map<NotificationRow>((entry) => {
    if ('single' in entry) {
      return { kind: 'single', notification: entry.single };
    }
    const items = sessionItems.get(entry.sessionId) as InAppNotification[];
    if (items.length === 1) {
      return { kind: 'single', notification: items[0] };
    }
    return {
      kind: 'group',
      sessionId: entry.sessionId,
      items,
      latest: items[0],
      unread: items.filter((i) => !i.isRead).length,
    };
  });
}
