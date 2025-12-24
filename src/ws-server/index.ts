import dbClient from '@/lib/dbClient';
import { verifyToken } from '@/pages/api/utils/authMiddleware';
import {
  ACCESS_SECRET,
  generateTokens,
  REFRESH_SECRET,
} from '@/pages/api/utils/tokenUtils';
import { AUTH_REFRESH_COOKIE_NAME } from '@/pages/lib/constants';
import { ChatMessageProps } from '@/pages/lib/types';
import { AuthenticatedConnection } from '@/ws-server/lib/types';
import { sendMessage, verifySessionParticipant } from '@/ws-server/lib/utils';
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
  tempId: z.string().optional(), // todo: remove optional after completion
  sessionId: z.string(),
  senderId: z.string(),
  senderRole: z.enum([UserRole.ADMIN, UserRole.FREE, UserRole.SUPERUSER]),
  content: z.string().max(5000),
  timestamp: z.string(),
});

const connections = new Map<string, Set<AuthenticatedConnection>>();

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

    const { userId } = await verifyToken(accessToken, ACCESS_SECRET);
    safeConnection.userId = userId;

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

    // Warn if tempId is missing (for monitoring client adoption)
    if (!tempId) {
      console.warn(
        filepath,
        `Message received without tempId from user ${senderId} - no idempotency protection`,
      );
    }

    // Session Authorization Check
    const session = await verifySessionParticipant(sessionId, senderId);

    if (!session) {
      console.error(
        filepath,
        `Unauthorized: User ${senderId} not in session ${sessionId}`,
      );
      sendMessage(safeConnection, {
        type: 'ack',
        tempId,
        timestamp,
        success: false,
        error: 'UNAUTHORIZED',
      });
      return;
    }

    // Idempotency Check using tempId
    if (tempId) {
      const existing = await dbClient.chatMessage.findUnique({
        where: { tempId },
      });
      if (existing) {
        // Message already saved, just send ACK
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

    const outgoingMessage: ChatMessageProps = {
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
        if (safeConnection !== conn) {
          sendMessage(conn, outgoingMessage);
        }
      });
    });
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

    // session verification
    const session = await verifySessionParticipant(sessionId, userId);
    if (!session) {
      console.error(
        filepath,
        `Unauthorized history request: User ${userId} not in session ${sessionId}`,
      );
      return;
    }

    // fetch messages
    // We want "limit" 50 before the cursor.
    // Prisma cursor pagination:
    // take: -50 (backwards from cursor)
    // skip: 1 (to exclude the cursor itself)
    // cursor: { id: cursorId }
    // orderBy: { createdAt: 'asc', id: 'asc' } (deterministic)
    const messages = await dbClient.chatMessage.findMany({
      take: -50,
      skip: cursorId ? 1 : 0,
      cursor: cursorId ? { id: cursorId } : undefined,
      where: { sessionId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        // We might need to select specific fields if we want to check something,
        // but currently we just return the message object.
        // senderId, senderRole, content, etc. are on the root.
      },
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
    if (error instanceof ZodError) {
      // Ignored: expected as this handler is tried for all messages in the loop below
    } else {
      console.error(filepath, 'handleGetMessages error:', error);
    }
  }
};

/*
// TODO: Re-enable next week after client implementation and testing
const handleReadReceipt = async (
  incomingMessage: RawData,
  safeConnection: AuthenticatedConnection,
) => {
  try {
    const { sessionId, messageIds } = JSON.parse(incomingMessage.toString());
    const userId = safeConnection.userId;

    if (!sessionId || !Array.isArray(messageIds)) {
      console.error(filepath, 'Invalid read receipt format');
      return;
    }

    // Verify user is participant
    const session = await verifySessionParticipant(sessionId, userId);

    if (!session) {
      console.error(
        filepath,
        `Unauthorized: User ${userId} not in session ${sessionId}`,
      );
      return;
    }

    // Mark messages as read
    await dbClient.chatMessage.updateMany({
      where: {
        id: { in: messageIds },
        sessionId,
      },
      data: { isRead: true },
    });

    // Broadcast read receipt to other participants
    const readAck: ChatMessageProps = {
      type: 'read_ack',
      sessionId,
      messageIds,
    };

    session.users.forEach((user) => {
      if (user.id !== userId) {
        connections.get(user.id)?.forEach((conn) => {
          sendMessage(conn, readAck);
        });
      }
    });
  } catch (error) {
    console.error(filepath, 'Error handling read receipt:', error);
  }
};
*/

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

      safeConnection.on('message', (message: RawData) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.type === 'get_messages') {
            handleGetMessages(message, safeConnection);
          } else {
            // Default to chat message handler
            handleMessage(message, safeConnection);
          }
        } catch (error) {
          console.error(filepath, 'Failed to route message:', error);
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
