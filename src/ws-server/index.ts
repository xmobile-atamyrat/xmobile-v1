import { createServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '@/pages/api/utils/authMiddleware';
import { JsonWebTokenError } from 'jsonwebtoken';
import { ACCESS_SECRET } from '@/pages/api/utils/tokenUtils';
import { UserRole } from '@prisma/client';

const filepath = 'src/ws-server/index.ts';

const server = createServer();
const wsServer = new WebSocketServer({ server });
const port = process.env.WEBSOCKET_SERVER_PORT;

const connections = new Map<string, Set<WebSocket>>();
const users: Record<UserRole, Set<string>> = {
  FREE: new Set(),
  ADMIN: new Set(),
  SUPERUSER: new Set(),
};

const handleConnectionClose = (
  userId: string,
  grade: UserRole,
  connection: WebSocket,
) => {
  connections.get(userId)?.delete(connection);
  if (!connections.get(userId).size) connections.delete(userId);
  users[grade]?.delete(userId);
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
    connection.close(1008, 'Unauthorized: Missing or invalid token format');
    return { userId: null, grade: null };
  }

  const token = authHeader.split(' ')[1];

  try {
    const { userId, grade } = await verifyToken(token, ACCESS_SECRET);
    if (!connections.has(userId)) {
      connections.set(userId, new Set());
    }
    connections.get(userId).add(connection);
    users[grade as UserRole]?.add(userId);

    return { userId, grade };
  } catch (error) {
    console.error(filepath, error);
    if (error instanceof JsonWebTokenError) {
      console.error(filepath, `Invalid token: ${token};`);
      connection.close(1008, 'Unauthorized: Missing or invalid token format');
    }
    return { userId: null, grade: null };
  }
};

wsServer.on('connection', async (connection, request) => {
  try {
    const { userId, grade }: { userId: string; grade: UserRole } =
      await verifyConnection(connection, request);

    connection.send('Hello from X-mobile 👋');

    connection.on('message', () => {});

    connection.on('close', () =>
      handleConnectionClose(userId, grade, connection),
    );
  } catch (error) {
    console.error('Connection error:', error);
    connection.close(1008, 'Unauthorized: Connection failed');
  }
});

server.listen(port);
