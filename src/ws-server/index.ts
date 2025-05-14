import dbClient from '@/lib/dbClient';
import { verifyToken } from '@/pages/api/utils/authMiddleware';
import {
  ACCESS_SECRET,
  generateTokens,
  REFRESH_SECRET,
} from '@/pages/api/utils/tokenUtils';
import { UserRole } from '@prisma/client';
import { createServer, IncomingMessage } from 'http';
import { parse } from 'url';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { z, ZodError } from 'zod';
import cookie from 'cookie';
import { AUTH_REFRESH_COOKIE_NAME } from '@/pages/lib/constants';
import { AuthenticatedConnection, ChatMessageProps } from '@/pages/lib/types';
import { sendMessage } from '@/ws-server/utils';

const filepath = 'src/ws-server/index.ts';

const server = createServer();
const wsServer = new WebSocketServer({ server });
const port = process.env.NEXT_PUBLIC_WEBSOCKET_PORT;

const MessageSchema = z.object({
  sessionId: z.string(),
  senderId: z.string(),
  senderRole: z.enum([UserRole.ADMIN, UserRole.FREE, UserRole.SUPERUSER]),
  content: z.string(),
  timestamp: z.string(),
});

const connections = new Map<string, Set<AuthenticatedConnection>>();

const safeCloseConnection = (
  code: number,
  reason: string,
  connection: WebSocket | AuthenticatedConnection,
) => {
  if (connection != null) {
    if (connection.readyState === WebSocket.OPEN) {
      connection.close(code, reason);
    }

    if ('userId' in connection) {
      const userId = connection.userId;
      connections.get(userId)?.delete(connection);
      if (!connections.get(userId)?.size) connections.delete(userId);
    }
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
          await generateTokens(userId, grade);

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
  let timestamp: string | undefined;
  try {
    const parsedMessage = JSON.parse(incomingMessage.toString());

    const {
      senderId,
      senderRole,
      content,
      sessionId,
      timestamp: ts,
    } = MessageSchema.parse(parsedMessage);
    timestamp = ts;

    const message = await dbClient.chatMessage.create({
      data: {
        senderId,
        content,
        senderRole,
        sessionId,
      },
    });

    sendMessage(safeConnection, {
      type: 'ack',
      messageId: message.id,
      timestamp,
      date: message.updatedAt,
      success: true,
    });

    const { users: sessionUsers } = await dbClient.chatSession.findUnique({
      where: {
        id: message.sessionId,
      },
      select: { users: true },
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
    sessionUsers.forEach((sessionUser) => {
      connections
        .get(sessionUser.id)
        ?.forEach(
          (conn) =>
            safeConnection !== conn && sendMessage(conn, outgoingMessage),
        );
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
        timestamp,
        success: false,
      });
    } catch (err) {
      console.error(filepath, err);
    }
  }
};

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

      safeConnection.on('message', (message: RawData) =>
        handleMessage(message, safeConnection),
      );

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
