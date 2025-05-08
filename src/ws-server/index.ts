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

const filepath = 'src/ws-server/index.ts';

const server = createServer();
const wsServer = new WebSocketServer({ server });
const port = process.env.NEXT_PUBLIC_WEBSOCKET_PORT;

const MessageSchema = z
  .object({
    sessionId: z.string(),
    senderId: z.string(),
    senderRole: z.enum([UserRole.ADMIN, UserRole.FREE, UserRole.SUPERUSER]),
    content: z.string(),
    isRead: z.boolean(),
  })
  .strict();

interface AuthenticatedConnection extends WebSocket {
  accessToken: string;
  userId: string;
}

const connections = new Map<string, Set<AuthenticatedConnection>>();

const safeCloseConnection = (
  code: number,
  reason: string,
  connection: WebSocket | AuthenticatedConnection,
) => {
  if (connection != null) {
    connection.close(code, reason);

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
      return null;
    }

    const { userId } = await verifyToken(accessToken, ACCESS_SECRET);

    safeConnection.userId = userId;
    safeConnection.accessToken = accessToken;

    return safeConnection;
  } catch (accessTokenError) {
    if (accessTokenError.name === 'TokenExpiredError') {
      try {
        const cookies = cookie.parse(request.headers?.cookie);
        const refreshToken = cookies[AUTH_REFRESH_COOKIE_NAME];

        const { userId, grade } = await verifyToken(
          refreshToken,
          REFRESH_SECRET,
        );
        const { accessToken: newAccessToken } = await generateTokens(
          userId,
          grade,
        );

        safeConnection.userId = userId;
        safeConnection.accessToken = newAccessToken;

        return safeConnection;
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
        return null;
      }
    }
    console.error(
      filepath,
      `Unauthorized: Invalid or expired access token: ${request.url}`,
    );
    safeCloseConnection(
      1008,
      'Unauthorized: Invalid or expired access token',
      safeConnection,
    );
    return null;
  }
};

const handleMessage = async (message: RawData) => {
  try {
    const parsedMessage = JSON.parse(message.toString());

    const { senderId, senderRole, isRead, content, sessionId } =
      MessageSchema.parse(parsedMessage);
    const messageData = await dbClient.chatMessage.create({
      data: {
        senderId,
        isRead,
        content,
        senderRole,
        sessionId,
      },
    });

    const { users: sessionUsers } = await dbClient.chatSession.findUnique({
      where: {
        id: messageData.sessionId,
      },
      select: { users: true },
    });

    sessionUsers?.forEach((sessionUser) => {
      const outgoingMessage = JSON.stringify({
        ...messageData,
        senderName: sessionUser.name,
      });

      connections
        .get(sessionUser.id)
        ?.forEach((conn) => conn.send(outgoingMessage));
    });
  } catch (error) {
    if (error instanceof ZodError)
      console.error(
        filepath,
        `InvalidMessageType: Invalid message props or types. Message: ${message}`,
      );
    else console.error(filepath, error);
  }
};

wsServer.on('connection', async (connection, request) => {
  try {
    const safeConnection = await authenticateConnection(request, connection);

    if (safeConnection?.userId != null) {
      if (!connections.has(safeConnection.userId))
        connections.set(safeConnection.userId, new Set());
      connections.get(safeConnection.userId)?.add(safeConnection);
    }

    connection.on('message', (message) => handleMessage(message));

    connection.on('close', () =>
      safeCloseConnection(1001, 'Offline: User Disconnected', safeConnection),
    );
  } catch (error) {
    console.error('Connection error:', error);
    safeCloseConnection(1008, 'Unauthorized: Connection failed', connection);
  }
});

server.listen(port);
