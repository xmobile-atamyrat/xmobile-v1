import { createServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { verifyToken } from '@/pages/api/utils/authMiddleware';
import { JsonWebTokenError } from 'jsonwebtoken';
import { ACCESS_SECRET } from '@/pages/api/utils/tokenUtils';
import { UserRole } from '@prisma/client';
import dbClient from '@/lib/dbClient';
import { parse } from 'url';
import { z, ZodError } from 'zod';

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
  connection.close(code, reason);

  if ('userId' in connection) {
    const userId = connection.userId;
    connections.get(userId)?.delete(connection);
    if (!connections.get(userId)?.size) connections.delete(userId);
  }
};

const authenticateConnection = async (
  request: IncomingMessage,
  connection: WebSocket,
) => {
  try {
    const token = parse(request.url, true).query?.accessToken;

    if (!token || typeof token !== 'string') {
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

    // todo: update accessToken if outdated
    const { userId } = await verifyToken(token, ACCESS_SECRET);

    const safeConnection = connection as AuthenticatedConnection;
    safeConnection.userId = userId;
    safeConnection.accessToken = token;

    return safeConnection;
  } catch (error) {
    console.error(filepath, error);
    if (error instanceof JsonWebTokenError) {
      console.error(filepath, `InvalidToken: ${request.url}`);
    }
    safeCloseConnection(1008, 'Unauthorized: Invalid token', connection);
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

    if (safeConnection != null) {
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
