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

console.log('[WS-Server] Initializing WebSocket server', {
  port,
  nodeEnv: process.env.NODE_ENV,
  hasPort: !!port,
});

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
  console.log('[WS-Server] authenticateConnection() called', {
    url: request.url?.replace(/accessToken=[^&]*/, 'accessToken=HIDDEN'),
    method: request.method,
    headers: {
      cookie: !!request.headers.cookie,
      upgrade: request.headers.upgrade,
      connection: request.headers.connection,
    },
  });

  try {
    const accessToken = parse(request.url, true).query?.accessToken;

    console.log('[WS-Server] Parsed access token from URL', {
      hasAccessToken: !!accessToken,
      accessTokenType: typeof accessToken,
      urlPath: parse(request.url, true).pathname,
    });

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

    console.log('[WS-Server] Verifying access token');
    const { userId, grade } = await verifyToken(accessToken, ACCESS_SECRET);
    console.log('[WS-Server] Access token verified successfully', {
      userId,
      grade,
    });
    safeConnection.userId = userId;
    safeConnection.userGrade = grade;

    return { safeConnection };
  } catch (accessTokenError) {
    console.log('[WS-Server] Access token verification failed', {
      errorName: accessTokenError.name,
      errorMessage: accessTokenError.message,
      isTokenExpired: accessTokenError.name === 'TokenExpiredError',
    });
    if (accessTokenError.name === 'TokenExpiredError') {
      console.log('[WS-Server] Access token expired, trying refresh token');
      try {
        const cookies = cookie.parse(request.headers?.cookie);
        const refreshToken = cookies[AUTH_REFRESH_COOKIE_NAME];

        console.log('[WS-Server] Refresh token found', {
          hasRefreshToken: !!refreshToken,
        });

        const { userId, grade } = await verifyToken(
          refreshToken,
          REFRESH_SECRET,
        );
        console.log(
          '[WS-Server] Refresh token verified, generating new tokens',
          {
            userId,
            grade,
          },
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
          {
            errorName: refreshTokenError.name,
            errorMessage: refreshTokenError.message,
          },
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

wsServer.on('connection', async (connection, request) => {
  console.log('[WS-Server] New WebSocket connection attempt', {
    url: request.url?.replace(/accessToken=[^&]*/, 'accessToken=HIDDEN'),
    remoteAddress: request.socket.remoteAddress,
    readyState: connection.readyState,
  });

  try {
    const { safeConnection, accessToken, refreshToken } =
      await authenticateConnection(request, connection);

    console.log('[WS-Server] Authentication result', {
      hasSafeConnection: !!safeConnection,
      hasUserId: !!safeConnection?.userId,
      hasNewTokens: !!(accessToken && refreshToken),
    });

    if (safeConnection?.userId != null) {
      if (!connections.has(safeConnection.userId)) {
        connections.set(safeConnection.userId, new Set());
      }
      connections.get(safeConnection.userId)?.add(safeConnection);

      console.log('[WS-Server] Connection authenticated and added', {
        userId: safeConnection.userId,
        userGrade: safeConnection.userGrade,
        totalConnectionsForUser: connections.get(safeConnection.userId)?.size,
        totalUsers: connections.size,
      });

      if (accessToken != null) {
        console.log('[WS-Server] Sending token refresh to client');
        try {
          sendMessage(safeConnection, {
            type: 'auth_refresh',
            accessToken,
            refreshToken,
          });
        } catch (error) {
          console.error(filepath, 'Error sending auth refresh:', error);
        }
      }

      safeConnection.on('message', (message: RawData) => {
        try {
          const parsed = JSON.parse(message.toString());
          console.log('[WS-Server] Message received from client', {
            type: parsed.type,
            sessionId: parsed.sessionId,
            senderId: parsed.senderId,
            hasContent: !!parsed.content,
          });

          if (parsed.type === 'get_messages') {
            handleGetMessages(message, safeConnection);
          } else if (parsed.type === 'message') {
            handleMessage(message, safeConnection);
          } else if (parsed.sessionId) {
            handleSessionRelay(message, safeConnection);
          } else {
            console.warn(filepath, 'Unknown message type:', parsed.type);
          }
        } catch (err) {
          console.error(filepath, 'Failed to handle message:', err, {
            rawMessage: message.toString().substring(0, 200),
          });
        }
      });

      safeConnection.on('close', (code, reason) => {
        console.log('[WS-Server] Connection closed by client', {
          userId: safeConnection.userId,
          code,
          reason: reason.toString(),
        });
        safeCloseConnection(1001, 'Offline: User Disconnected', safeConnection);
      });

      safeConnection.on('error', (error) => {
        console.error('[WS-Server] WebSocket error', {
          userId: safeConnection.userId,
          error: error.message,
          stack: error.stack,
        });
      });
    } else {
      console.warn('[WS-Server] Connection rejected - no authenticated user');
    }
  } catch (error) {
    console.error('[WS-Server] Connection error:', error, {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    });
    safeCloseConnection(1008, 'Unauthorized: Connection failed', connection);
  }
});

if (!port) {
  console.error('[WS-Server] ERROR: NEXT_PUBLIC_WEBSOCKET_PORT is not set');
  process.exit(1);
}

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error('[WS-Server] Server error:', {
    code: error.code,
    message: error.message,
    port,
  });
  if (error.code === 'EADDRINUSE') {
    console.error(`[WS-Server] Port ${port} is already in use`);
  }
  process.exit(1);
});

server.listen(port, () => {
  console.log(`[WS-Server] WebSocket server listening on port ${port}`);
});

console.log('[WS-Server] Server setup complete, waiting for connections...');
