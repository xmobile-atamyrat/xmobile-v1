import { createServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '@/pages/api/utils/authMiddleware';
import { JsonWebTokenError } from 'jsonwebtoken';
import { ACCESS_SECRET } from '@/pages/api/utils/tokenUtils';

const filepath = 'src/ws-server/index.ts';

const server = createServer();
const wsServer = new WebSocketServer({ server });
const port = process.env.WEBSOCKET_SERVER_PORT;

const connections = new Map<string, Set<WebSocket>>();

const safeCloseConnection = (
  code: number,
  reason: string,
  userId: string,
  connection: WebSocket,
) => {
  connection.close(code, reason);
  connections.get(userId)?.delete(connection);
  if (!connections.get(userId)?.size) connections.delete(userId);
};

const verifyConnection = async (
  connection: WebSocket,
  request: IncomingMessage,
) => {
  const authHeader = request.headers?.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error(
      filepath,
      `. Unauthorized: Missing or invalid header format: ${authHeader}`,
    );
    safeCloseConnection(
      1008,
      'Unauthorized: Missing or invalid format',
      null,
      connection,
    );
    return { userId: null };
  }

  const token = authHeader.split(' ')[1];
  try {
    const { userId } = await verifyToken(token, ACCESS_SECRET);

    if (!connections.has(userId)) {
      connections.set(userId, new Set());
    }
    connections.get(userId)?.add(connection);

    return { userId };
  } catch (error) {
    console.error(filepath, error);
    if (error instanceof JsonWebTokenError) {
      console.error(filepath, `InvalidToken: ${token};`);
      safeCloseConnection(
        1008,
        'Unauthorized: Missing or format',
        null,
        connection,
      );
    }
    return { userId: null };
  }
};

wsServer.on('connection', async (connection, request) => {
  try {
    const { userId }: { userId: string } = await verifyConnection(
      connection,
      request,
    );

    connection.on('message', () => {});

    connection.on('close', () =>
      safeCloseConnection(
        1001,
        'Offline: User Disconnected',
        userId,
        connection,
      ),
    );
  } catch (error) {
    console.error('Connection error:', error);
    connection.close(1008, 'Unauthorized: Connection failed');
  }
});

server.listen(port);
