import dbClient from '@/lib/dbClient';
import { ChatMessageProps, InAppNotification } from '@/pages/lib/types';
import { AuthenticatedConnection } from '@/ws-server/lib/types';
import { NotificationType } from '@prisma/client';
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
