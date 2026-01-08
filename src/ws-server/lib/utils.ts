import dbClient from '@/lib/dbClient';
import { ChatMessageProps, InAppNotification } from '@/pages/lib/types';
import { AuthenticatedConnection } from '@/ws-server/lib/types';
import { NotificationType, UserOrderStatus } from '@prisma/client';
import { WebSocket } from 'ws';

export function sendMessage(
  safeConnection: AuthenticatedConnection,
  message: ChatMessageProps,
) {
  if (safeConnection.readyState !== WebSocket.OPEN) {
    return;
  }

  safeConnection.send(JSON.stringify(message));
}

export async function verifySessionParticipant(
  sessionId: string,
  userId: string,
) {
  const session = await dbClient.chatSession.findFirst({
    where: {
      id: sessionId,
      users: { some: { id: userId } },
    },
    include: { users: true },
  });

  return session;
}

/**
 * Creates notifications for all session participants except the sender
 */
export async function createNotificationsForSession(
  sessionId: string,
  senderId: string,
  content: string,
  title?: string,
): Promise<InAppNotification[]> {
  try {
    // Get session with all users
    const session = await dbClient.chatSession.findUnique({
      where: { id: sessionId },
      include: { users: true },
    });

    if (!session) {
      console.error(
        'createNotificationsForSession: Session not found',
        sessionId,
      );
      return [];
    }

    // Get sender name for notification title
    const sender = await dbClient.user.findUnique({
      where: { id: senderId },
      select: { name: true },
    });

    const notificationTitle =
      title || (sender ? `${sender.name}` : 'New message');

    // Filter out sender from participants
    const recipients = session.users.filter((user) => user.id !== senderId);

    if (recipients.length === 0) {
      return [];
    }

    // Create notifications in batch using transaction with parallel execution
    const createdNotifications = await dbClient.$transaction(async (tx) => {
      // Create all notifications in parallel
      const notificationPromises = recipients.map((recipient) =>
        tx.inAppNotification.create({
          data: {
            userId: recipient.id,
            sessionId,
            type: NotificationType.CHAT_MESSAGE,
            title: notificationTitle,
            content,
            isRead: false,
          },
        }),
      );
      return Promise.all(notificationPromises);
    });

    return createdNotifications;
  } catch (error) {
    console.error('createNotificationsForSession error:', error);
    return [];
  }
}

/**
 * Sends notifications to a user via WebSocket if they are connected
 * @param connectionsMap - The connections map from the WebSocket server
 * @returns Number of unique notifications sent (not total sends)
 */
export function sendNotificationsToUser(
  connectionsMap: Map<string, Set<AuthenticatedConnection>>,
  userId: string,
  notifications: InAppNotification[],
): number {
  const userConnections = connectionsMap.get(userId);
  if (!userConnections || userConnections.size === 0) {
    return 0;
  }

  // Send each notification to all user's connections
  // Count unique notifications sent, not total sends
  let uniqueNotificationsSent = 0;
  notifications.forEach((notification) => {
    let sentToAtLeastOne = false;
    userConnections.forEach((conn) => {
      try {
        sendMessage(conn, {
          type: 'notification',
          notification,
        });
        sentToAtLeastOne = true;
      } catch (error) {
        console.error(
          `Failed to send notification ${notification.id} to user ${userId}:`,
          error,
        );
      }
    });
    if (sentToAtLeastOne) {
      uniqueNotificationsSent += 1;
    }
  });

  return uniqueNotificationsSent;
}

/**
 * Gets unread notifications for a user
 */
export async function getUnreadNotificationsForUser(
  userId: string,
  limit: number = 50,
): Promise<InAppNotification[]> {
  try {
    const notifications = await dbClient.inAppNotification.findMany({
      where: {
        userId,
        isRead: false,
      },
      include: {
        session: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return notifications as InAppNotification[];
  } catch (error) {
    console.error('getUnreadNotificationsForUser error:', error);
    return [];
  }
}

/**
 * Gets all admin and superuser user IDs
 */
export async function getAllAdminUsers(): Promise<string[]> {
  try {
    const admins = await dbClient.user.findMany({
      where: {
        grade: {
          in: ['ADMIN', 'SUPERUSER'],
        },
      },
      select: {
        id: true,
      },
    });

    return admins.map((admin) => admin.id);
  } catch (error) {
    console.error('getAllAdminUsers error:', error);
    return [];
  }
}

/**
 * Creates a notification for order status update (to order owner)
 */
export async function createNotificationForOrderStatusUpdate(
  orderId: string,
  userId: string,
  orderNumber: string,
  newStatus: UserOrderStatus,
  previousStatus: UserOrderStatus,
): Promise<InAppNotification | null> {
  try {
    // Get status labels for better notification content (in Russian)
    const statusLabels: Record<UserOrderStatus, string> = {
      PENDING: 'Ожидает',
      IN_PROGRESS: 'В процессе',
      COMPLETED: 'Завершен',
      USER_CANCELLED: 'Отменен',
      ADMIN_CANCELLED: 'Отменен',
    };

    const newStatusLabel = statusLabels[newStatus] || newStatus;
    const previousStatusLabel = statusLabels[previousStatus] || previousStatus;

    const notification = await dbClient.inAppNotification.create({
      data: {
        userId,
        orderId,
        type: NotificationType.ORDER_STATUS_UPDATE,
        title: 'Статус заказа обновлен',
        content: `Статус вашего заказа #${orderNumber} изменен с "${previousStatusLabel}" на "${newStatusLabel}"`,
        isRead: false,
      },
    });

    return notification as InAppNotification;
  } catch (error) {
    console.error('createNotificationForOrderStatusUpdate error:', error);
    return null;
  }
}

/**
 * Creates notifications for all admins (for new orders or cancellations)
 */
export async function createNotificationsForAdmins(
  orderId: string,
  orderNumber: string,
  notificationType: 'NEW_ORDER' | 'ORDER_CANCELLED',
  userName?: string,
): Promise<InAppNotification[]> {
  try {
    const adminUserIds = await getAllAdminUsers();

    if (adminUserIds.length === 0) {
      return [];
    }

    // Determine notification content based on type (in Russian)
    let title: string;
    let content: string;

    if (notificationType === 'NEW_ORDER') {
      title = 'Новый заказ';
      content = userName
        ? `Новый заказ #${orderNumber} от ${userName}`
        : `Новый заказ #${orderNumber}`;
    } else {
      // ORDER_CANCELLED
      title = 'Заказ отменен';
      content = userName
        ? `Заказ #${orderNumber} отменен пользователем ${userName}`
        : `Заказ #${orderNumber} отменен пользователем`;
    }

    // Create notifications in batch using transaction with parallel execution
    const createdNotifications = await dbClient.$transaction(async (tx) => {
      // Create all notifications in parallel
      const notificationPromises = adminUserIds.map((adminId) =>
        tx.inAppNotification.create({
          data: {
            userId: adminId,
            orderId,
            type: NotificationType.ORDER_STATUS_UPDATE,
            title,
            content,
            isRead: false,
          },
        }),
      );
      return Promise.all(notificationPromises);
    });

    return createdNotifications as InAppNotification[];
  } catch (error) {
    console.error('createNotificationsForAdmins error:', error);
    return [];
  }
}
