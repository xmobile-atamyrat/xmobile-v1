import dbClient from '@/lib/dbClient';
import { verifyToken } from '@/pages/api/utils/authMiddleware';
import {
  ACCESS_SECRET,
  generateTokens,
  REFRESH_SECRET,
} from '@/pages/api/utils/tokenUtils';
import { AUTH_REFRESH_COOKIE_NAME } from '@/pages/lib/constants';
import { ChatMessage } from '@/pages/lib/types';
import { AuthenticatedConnection } from '@/ws-server/lib/types';
import {
  createNotificationsForSession,
  getUnreadNotificationsForUser,
  sendMessage,
  sendNotificationsToUser,
  verifySessionParticipant,
} from '@/ws-server/lib/utils';
import { UserRole } from '@prisma/client';
import cookie from 'cookie';
import { createServer, IncomingMessage } from 'http';
import { parse } from 'url';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { z, ZodError } from 'zod';

const filepath = 'src/ws-server/index.ts';

const server = createServer();
const wsServer = new WebSocketServer({ server });
const port = process.env.NEXT_PUBLIC_WEBSOCKET_PORT;

const MessageSchema = z.object({
  tempId: z.string().optional(),
  sessionId: z.string(),
  senderId: z.string(),
  senderRole: z.enum([UserRole.ADMIN, UserRole.FREE, UserRole.SUPERUSER]),
  content: z.string().max(5000),
  timestamp: z.string(),
});

export const connections = new Map<string, Set<AuthenticatedConnection>>();

const safeCloseConnection = (
  code: number,
  reason: string,
  connection: WebSocket | AuthenticatedConnection,
) => {
  if (connection == null) return;

  if (connection.readyState === WebSocket.OPEN) connection.close(code, reason);

  if ('userId' in connection) {
    const userId = connection?.userId;
    connections.get(userId)?.delete(connection);
    if (!connections.get(userId)?.size) connections.delete(userId);
  }
};

const authenticateConnection = async (
  request: IncomingMessage,
  connection: WebSocket,
) => {
  const safeConnection = connection as AuthenticatedConnection;
  try {
    const accessToken = parse(request.url, true).query?.accessToken;

    if (!accessToken || typeof accessToken !== 'string') {
      console.error(
        `${filepath}. Unauthenticated: Missing or invalid token: ${request.url}`,
      );
      safeCloseConnection(
        1008,
        'Unauthenticated: Missing or invalid token',
        connection,
      );
      return { safeConnection: null };
    }

    const { userId, grade } = await verifyToken(accessToken, ACCESS_SECRET);
    safeConnection.userId = userId;
    safeConnection.userGrade = grade;

    return { safeConnection };
  } catch (accessTokenError) {
    if (accessTokenError.name === 'TokenExpiredError') {
      try {
        const cookies = cookie.parse(request.headers?.cookie);
        const refreshToken = cookies[AUTH_REFRESH_COOKIE_NAME];

        const { userId, grade } = await verifyToken(
          refreshToken,
          REFRESH_SECRET,
        );
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
          generateTokens(userId, grade);

        safeConnection.userId = userId;
        safeConnection.userGrade = grade;

        return {
          safeConnection,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        };
      } catch (refreshTokenError) {
        console.error(
          filepath,
          'Unauthorized: Invalid or expired refresh token',
        );
        safeCloseConnection(
          1008,
          'Unauthorized: Invalid or expired refresh token',
          safeConnection,
        );
        return { safeConnection: null };
      }
    }
    console.error(
      filepath,
      `Unauthorized: Invalid access token: ${request.url}`,
    );
    safeCloseConnection(
      1008,
      'Unauthorized: Invalid access token',
      safeConnection,
    );
    return { safeConnection: null };
  }
};

const handleMessage = async (
  incomingMessage: RawData,
  safeConnection: AuthenticatedConnection,
) => {
  let parsedTimestamp: string | undefined;
  try {
    const parsedMessage = JSON.parse(incomingMessage.toString());

    const { senderId, senderRole, content, sessionId, timestamp, tempId } =
      MessageSchema.parse(parsedMessage);
    parsedTimestamp = timestamp;

    if (!tempId) {
      console.warn(
        filepath,
        `Message received without tempId from user ${senderId} - no idempotency protection`,
      );
    }

    if (senderId !== safeConnection.userId) {
      console.error(
        filepath,
        `Message rejected: senderId mismatch. Authenticated: ${safeConnection.userId}, Claimed: ${senderId}`,
      );
      sendMessage(safeConnection, {
        type: 'ack',
        success: false,
        tempId,
        error: 'invalid_sender',
      });
      return;
    }

    if (senderRole !== safeConnection.userGrade) {
      console.error(
        filepath,
        `Message rejected: senderRole mismatch. Authenticated: ${safeConnection.userGrade}, Claimed: ${senderRole}`,
      );
      sendMessage(safeConnection, {
        type: 'ack',
        success: false,
        tempId,
        error: 'invalid_role',
      });
      return;
    }

    const session = await verifySessionParticipant(
      sessionId,
      safeConnection.userId,
    );

    if (!session) {
      console.error(
        filepath,
        `Message rejected: User ${safeConnection.userId} not in session ${sessionId}`,
      );
      sendMessage(safeConnection, {
        type: 'ack',
        success: false,
        tempId,
        error: 'wrong_session',
      });
      return;
    }

    if (session.status === 'CLOSED') {
      console.warn(
        filepath,
        `Message rejected: Session ${sessionId} is CLOSED`,
      );
      sendMessage(safeConnection, {
        type: 'ack',
        success: false,
        tempId,
        error: 'closed_session',
      });
      return;
    }

    // Idempotency: prevent duplicate message if client retries with same tempId
    if (tempId) {
      const existing = await dbClient.chatMessage.findUnique({
        where: { tempId },
      });
      if (existing) {
        sendMessage(safeConnection, {
          type: 'ack',
          tempId,
          messageId: existing.id,
          timestamp,
          date: existing.updatedAt,
          success: true,
        });
        return;
      }
    }

    const message = await dbClient.chatMessage.create({
      data: {
        tempId,
        senderId,
        content,
        senderRole,
        sessionId,
      },
    });

    sendMessage(safeConnection, {
      type: 'ack',
      tempId,
      messageId: message.id,
      timestamp,
      date: message.updatedAt,
      success: true,
    });

    const outgoingMessage: ChatMessage = {
      type: 'message',
      messageId: message.id,
      sessionId,
      senderId,
      senderRole,
      content,
      isRead: message.isRead,
      date: message.updatedAt,
    };

    session.users.forEach((sessionUser) => {
      connections.get(sessionUser.id)?.forEach((conn) => {
        sendMessage(conn, outgoingMessage);
      });
    });

    // Create notifications for all participants except sender
    try {
      const notifications = await createNotificationsForSession(
        sessionId,
        senderId,
        content,
      );

      // Send notifications to users who are currently connected
      notifications.forEach((notification) => {
        if (notification.userId !== senderId) {
          sendNotificationsToUser(connections, notification.userId, [
            notification,
          ]);
        }
      });
    } catch (notificationError) {
      // Don't block message sending if notification creation fails
      console.error(
        filepath,
        'Failed to create/send notifications:',
        notificationError,
      );
    }
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(
        filepath,
        `InvalidMessage: Invalid message props or types. Message: ${incomingMessage.toString()}`,
      );
    }
    console.error(filepath, error.message);

    try {
      sendMessage(safeConnection, {
        type: 'ack',
        timestamp: parsedTimestamp,
        success: false,
      });
    } catch (err) {
      console.error(filepath, err);
    }
  }
};

const GetMessagesSchema = z.object({
  type: z.literal('get_messages'),
  sessionId: z.string(),
  cursorId: z.string().optional(),
});

const handleGetMessages = async (
  incomingMessage: RawData,
  safeConnection: AuthenticatedConnection,
) => {
  try {
    const parsed = JSON.parse(incomingMessage.toString());
    const { sessionId, cursorId } = GetMessagesSchema.parse(parsed);
    const userId = safeConnection.userId;

    const session = await verifySessionParticipant(sessionId, userId);
    if (!session) {
      console.error(
        filepath,
        `Unauthorized history request: User ${userId} not in session ${sessionId}`,
      );
      return;
    }

    // Cursor pagination: take: -50 (backwards), skip: 1 (exclude cursor), orderBy deterministic
    const messages = await dbClient.chatMessage.findMany({
      take: -50,
      skip: cursorId ? 1 : 0,
      cursor: cursorId ? { id: cursorId } : undefined,
      where: { sessionId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    sendMessage(safeConnection, {
      type: 'history',
      sessionId,
      messages: messages.map((msg) => ({
        ...msg,
        type: 'message', // Augment for frontend compatibility
        messageId: msg.id,
      })),
    });
  } catch (error) {
    if (!(error instanceof ZodError)) {
      console.error(filepath, 'handleGetMessages error:', error);
    }
  }
};

/**
 * Generic session relay - broadcasts any message to all session participants
 * Use for: session_status, typing_indicators, read_receipts, etc.
 * Server just validates sender is in session, then relays message as-is
 */
const handleSessionRelay = async (
  incomingMessage: RawData,
  safeConnection: AuthenticatedConnection,
) => {
  try {
    const parsed = JSON.parse(incomingMessage.toString());
    const { sessionId } = parsed;

    if (!sessionId) {
      console.error(filepath, 'Relay message missing sessionId');
      return;
    }

    const session = await verifySessionParticipant(
      sessionId,
      safeConnection.userId,
    );

    if (!session) {
      console.error(
        filepath,
        `Unauthorized relay: User ${safeConnection.userId} not in session ${sessionId}`,
      );
      return;
    }

    session.users.forEach((sessionUser) => {
      connections.get(sessionUser.id)?.forEach((conn) => {
        sendMessage(conn, parsed);
      });
    });
  } catch (error) {
    console.error(filepath, 'Error in session relay:', error);
  }
};

const MarkNotificationReadSchema = z.object({
  type: z.literal('mark_notification_read'),
  notificationIds: z.array(z.string()),
});

const handleMarkNotificationRead = async (
  incomingMessage: RawData,
  safeConnection: AuthenticatedConnection,
) => {
  try {
    const parsed = JSON.parse(incomingMessage.toString());
    const { notificationIds } = MarkNotificationReadSchema.parse(parsed);
    const userId = safeConnection.userId;

    // Verify all notifications belong to this user
    const notifications = await dbClient.inAppNotification.findMany({
      where: {
        id: { in: notificationIds },
        userId,
      },
    });

    if (notifications.length !== notificationIds.length) {
      console.error(
        filepath,
        `Some notifications not found or don't belong to user ${userId}`,
      );
      sendMessage(safeConnection, {
        type: 'mark_notification_read_ack',
        notificationIds,
        success: false,
      });
      return;
    }

    // Mark notifications as read
    await dbClient.inAppNotification.updateMany({
      where: {
        id: { in: notificationIds },
        userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    sendMessage(safeConnection, {
      type: 'mark_notification_read_ack',
      notificationIds,
      success: true,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(
        filepath,
        'Invalid mark_notification_read message:',
        error.errors,
      );
    } else {
      console.error(filepath, 'Error marking notifications as read:', error);
    }

    try {
      const parsed = JSON.parse(incomingMessage.toString());
      sendMessage(safeConnection, {
        type: 'mark_notification_read_ack',
        notificationIds: parsed.notificationIds || [],
        success: false,
      });
    } catch (err) {
      console.error(filepath, 'Failed to send error ack:', err);
    }
  }
};

// HTTP endpoint for sending notifications from API routes
// Must be set up before WebSocket upgrade handler
server.on('request', (req, res) => {
  // Skip WebSocket upgrade requests
  if (req.headers.upgrade === 'websocket') {
    return;
  }

  // Only handle POST requests to /notify
  if (req.method === 'POST' && req.url === '/notify') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { userId, notifications } = data;

        if (!userId || !notifications || !Array.isArray(notifications)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ success: false, message: 'Invalid request' }),
          );
          return;
        }

        // Send notifications to the user via WebSocket
        const sentCount = sendNotificationsToUser(
          connections,
          userId,
          notifications,
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, sentCount }));
      } catch (error) {
        console.error(filepath, 'Error handling /notify request:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ success: false, message: 'Internal server error' }),
        );
      }
    });
  } else {
    // For other requests, return 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
  }
});

wsServer.on('connection', async (connection, request) => {
  try {
    const { safeConnection, accessToken, refreshToken } =
      await authenticateConnection(request, connection);

    if (safeConnection?.userId != null) {
      if (!connections.has(safeConnection.userId)) {
        connections.set(safeConnection.userId, new Set());
      }
      connections.get(safeConnection.userId)?.add(safeConnection);

      if (accessToken != null) {
        try {
          sendMessage(safeConnection, {
            type: 'auth_refresh',
            accessToken,
            refreshToken,
          });
        } catch (error) {
          console.error(filepath, error);
        }
      }

      // Send unread notifications on connect
      try {
        const unreadNotifications = await getUnreadNotificationsForUser(
          safeConnection.userId,
          50,
        );
        const unreadCount = await dbClient.inAppNotification.count({
          where: {
            userId: safeConnection.userId,
            isRead: false,
          },
        });

        if (unreadNotifications.length > 0) {
          sendMessage(safeConnection, {
            type: 'notifications',
            notifications: unreadNotifications,
            unreadCount,
          });
        }
      } catch (error) {
        console.error(
          filepath,
          'Failed to send unread notifications on connect:',
          error,
        );
      }

      safeConnection.on('message', (message: RawData) => {
        try {
          const parsed = JSON.parse(message.toString());

          if (parsed.type === 'get_messages') {
            handleGetMessages(message, safeConnection);
          } else if (parsed.type === 'message') {
            handleMessage(message, safeConnection);
          } else if (parsed.type === 'mark_notification_read') {
            handleMarkNotificationRead(message, safeConnection);
          } else if (parsed.sessionId) {
            handleSessionRelay(message, safeConnection);
          } else {
            console.warn(filepath, 'Unknown message type:', parsed.type);
          }
        } catch (err) {
          console.error(filepath, 'Failed to handle message:', err);
        }
      });

      safeConnection.on('close', () =>
        safeCloseConnection(1001, 'Offline: User Disconnected', safeConnection),
      );
    }
  } catch (error) {
    console.error('Connection error:', error);
    safeCloseConnection(1008, 'Unauthorized: Connection failed', connection);
  }
});

server.listen(port);
