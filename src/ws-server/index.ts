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

const connections = new Map<string, WebSocket>();
const users: Record<UserRole, Set<string>> = {
  FREE: new Set(),
  ADMIN: new Set(),
  SUPERUSER: new Set(),
};

// todo: used for testing, remove once finished
const getUsers = () => {
  console.log('[USERS]: ', users); // eslint-disable-line no-console
  return users;
};
const getConnections = () => {
  console.log('[CONNECTIONS]: ', connections.keys()); // eslint-disable-line no-console
  return connections;
};

const handleConnectionClose = (userId: string, grade: UserRole) => {
  if (userId != null) {
    connections.delete(userId);
    users[grade]?.delete(userId);

    console.log(`[Connection closed]: ${userId}`); // eslint-disable-line no-console
  }
  getUsers();
  getConnections();
};

const verifyConnection = async (
  connection: WebSocket,
  request: IncomingMessage,
) => {
  const authHeader = request.headers?.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // todo: translations, remove part from unauthorized and define translations
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

    if (
      connections.has(userId) &&
      connections.get(userId) != null &&
      connections.get(userId).readyState === WebSocket.OPEN
    ) {
      throw new Error('MultipleConnectionError');
    }
    connections.set(userId, connection);
    users[grade as UserRole]?.add(userId);

    // todo: used for testing, remove once finished
    getUsers();
    getConnections();

    return { userId, grade };
  } catch (error) {
    console.error(filepath, error);
    if (error instanceof JsonWebTokenError) {
      // todo: translations, remove unauthorized details and define translations
      console.error(filepath, `Invalid token: ${token};`);
      connection.close(1008, 'Unauthorized: Missing or invalid token format');
    } else if (error.message === 'MultipleConnectionError') {
      // todo: translations, remove error details and define translations
      console.error(`${filepath}/ ${error.message}: Only one device allowed`);
      connection.close(1008, `${error.message}: Only one device allowed`);
    }
    return { userId: null, grade: null };
  }
};

wsServer.on('connection', async (connection, request) => {
  try {
    const { userId, grade }: { userId: string; grade: UserRole } =
      await verifyConnection(connection, request);

    connection.send('Hello from X-mobile 👋');

    connection.on('message', (message) => console.log(userId, ': ', message)); // eslint-disable-line no-console

    connection.on('close', () => handleConnectionClose(userId, grade));
  } catch (error) {
    console.error('Connection error:', error);
    connection.close(1008, 'Unauthorized: Connection failed');
  }
});

server.listen(port, () => {
  console.log(`Server is listening on ${port}`); // eslint-disable-line no-console
});
