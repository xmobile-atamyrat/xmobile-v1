import { createServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '@/pages/api/utils/authMiddleware';
import { JsonWebTokenError } from 'jsonwebtoken';
import { ACCESS_SECRET } from '@/pages/api/utils/tokenUtils';
import { parse } from 'url';

const filepath = 'src/ws-server/index.ts';

const server = createServer();
const wsServer = new WebSocketServer({ server });
const port = process.env.NEXT_PUBLIC_WEBSOCKET_PORT;

interface AuthenticatedConnection extends WebSocket {
  accessToken: string;
  userId: string;
}

const connections = new Map<string, Set<AuthenticatedConnection>>();

const safeCloseConnection = (
  code: number,
  reason: string,
  connection: AuthenticatedConnection,
) => {
  const userId = connection?.userId;
  connection.close(code, reason);
  connections.get(userId)?.delete(connection);
  if (!connections.get(userId)?.size) connections.delete(userId);
};

const authenticateConnection = async (
  request: IncomingMessage,
  connection: AuthenticatedConnection,
) => {
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
    return;
  }

  try {
    const { userId } = await verifyToken(token, ACCESS_SECRET);

    if (!connections.has(userId)) connections.set(userId, new Set());
    connections.get(userId)?.add(connection);

    connection.userId = userId;
    connection.accessToken = token;
  } catch (error) {
    console.error(filepath, error);
    if (error instanceof JsonWebTokenError) {
      console.error(filepath, `InvalidToken: ${token}`);

      safeCloseConnection(1008, 'Unauthorized: Invalid token', connection);
    }
  }
};

wsServer.on(
  'connection',
  async (connection: AuthenticatedConnection, request) => {
    try {
      await authenticateConnection(request, connection);

      connection.on('message', () => {});

      connection.on('close', () =>
        safeCloseConnection(1001, 'Offline: User Disconnected', connection),
      );
    } catch (error) {
      console.error('Connection error:', error);
      connection.close(1008, 'Unauthorized: Connection failed');
    }
  },
);

server.listen(port);
