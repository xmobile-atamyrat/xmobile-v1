import dbClient from '@/lib/dbClient';
import { verifyToken } from '@/pages/api/utils/authMiddleware';
import {
  ACCESS_SECRET,
  generateTokens,
  REFRESH_SECRET,
} from '@/pages/api/utils/tokenUtils';
import {
  AUTH_REFRESH_COOKIE_NAME,
  CHAT_MESSAGES_PAGE_SIZE,
} from '@/pages/lib/constants';
import { ChatMessage } from '@/pages/lib/types';
import { AuthenticatedConnection } from '@/ws-server/lib/types';
import {
  createNotificationsForSession,
  getUnreadNotificationsForUser,
  sendMessage,
  sendNotificationsToUser,
  sendNotificationWithFCMFallback,
  verifySessionParticipant,
  broadcastToSession,
  broadcastPresenceToAdmins,
  broadcastSupportPresence,
  getOnlineUserIds,
  isAdminGrade,
  isUserOnline,
} from '@/ws-server/lib/utils';
import cookie from 'cookie';
import { createServer, IncomingMessage } from 'http';
import { parse } from 'url';
import {
  GetMessagesSchema,
  MarkNotificationReadSchema,
  MessageSchema,
} from '@/ws-server/messageSchemas';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { ZodError } from 'zod';

const filepath = 'src/ws-server/index.ts';

const server = createServer();
const wsServer = new WebSocketServer({ server });
const port = process.env.NEXT_PUBLIC_WEBSOCKET_PORT;

export const connections = new Map<string, Set<AuthenticatedConnection>>();
export const adminConnections = new Set<AuthenticatedConnection>();

const safeCloseConnection = (
  code: number,
  reason: string,
  connection: WebSocket | AuthenticatedConnection,
) => {
  if (connection == null) return;

  if (connection.readyState === WebSocket.OPEN) connection.close(code, reason);

  const wasSupportOnline = adminConnections.size > 0;
  let wentOffline: string | null = null;

  if ('userId' in connection) {
    const userId = connection?.userId;
    connections.get(userId)?.delete(connection as AuthenticatedConnection);
    if (!connections.get(userId)?.size) {
      connections.delete(userId);
      // Last socket for this user: only now are they actually offline.
      wentOffline = userId;
    }
  }
  if ('userGrade' in connection && isAdminGrade(connection.userGrade)) {
    adminConnections.delete(connection as AuthenticatedConnection);
  }

  // Broadcast only once the maps are settled. Announcing earlier would let a
  // recipient recompute presence from the registry and disagree with the event
  // it just received -- and would send the departing socket its own obituary.
  if (wentOffline != null) {
    broadcastPresenceToAdmins(adminConnections, wentOffline, false);
  }
  if (wasSupportOnline && adminConnections.size === 0) {
    broadcastSupportPresence(connections, false);
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

        const { userId } = await verifyToken(refreshToken, REFRESH_SECRET);

        // Read current grade from DB so a role change is reflected in new tokens
        const freshUser = await dbClient.user.findUnique({
          where: { id: userId },
          select: { grade: true },
        });
        if (!freshUser) {
          safeCloseConnection(
            1008,
            'Unauthorized: User not found',
            safeConnection,
          );
          return { safeConnection: null };
        }

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
          generateTokens(userId, freshUser.grade);

        safeConnection.userId = userId;
        safeConnection.userGrade = freshUser.grade;

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

    const { session, isParticipant } = await verifySessionParticipant(
      sessionId,
      safeConnection.userId,
      safeConnection.userGrade,
    );

    if (!session || !isParticipant) {
      console.error(
        filepath,
        `Message rejected: User ${safeConnection.userId} not a participant in session ${sessionId}`,
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

    // Only fetch the sender's name if they are staff (Admin/Superuser)
    let senderName: string | undefined;
    if (senderRole !== 'FREE') {
      const staffMember = await dbClient.user.findUnique({
        where: { id: senderId },
        select: { name: true },
      });
      senderName = staffMember?.name;
    }

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
      senderName,
      content,
      isRead: message.isRead,
      date: message.updatedAt,
    };

    broadcastToSession(connections, adminConnections, session, outgoingMessage);

    // Bump session's updatedAt so admin chat lists sort by last message, not
    // session start. Done after broadcast so a failure here can't drop the
    // message (the send path already succeeded).
    try {
      await dbClient.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });
    } catch (bumpError) {
      console.error(filepath, 'Failed to bump session updatedAt:', bumpError);
    }

    // Create notifications for all participants except sender
    try {
      const notifications = await createNotificationsForSession(
        sessionId,
        senderId,
        content,
      );

      // Send notifications with FCM first, fallback to WebSocket
      notifications.forEach((notification) => {
        if (notification.userId !== senderId) {
          sendNotificationWithFCMFallback(
            connections,
            notification.userId,
            notification,
          ).catch((error) => {
            console.error(
              filepath,
              `Failed to send notification ${notification.id} to user ${notification.userId}:`,
              error,
            );
          });
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

const handleGetMessages = async (
  incomingMessage: RawData,
  safeConnection: AuthenticatedConnection,
) => {
  try {
    const parsed = JSON.parse(incomingMessage.toString());
    const { sessionId, cursorId } = GetMessagesSchema.parse(parsed);
    const userId = safeConnection.userId;

    const { session } = await verifySessionParticipant(
      sessionId,
      userId,
      safeConnection.userGrade,
    );
    if (!session) {
      console.error(
        filepath,
        `Unauthorized history request: User ${userId} blocked from session ${sessionId}`,
      );
      return;
    }

    // Cursor pagination: take backwards, skip: 1 (exclude cursor), orderBy deterministic
    const messages = await dbClient.chatMessage.findMany({
      take: -CHAT_MESSAGES_PAGE_SIZE,
      skip: cursorId ? 1 : 0,
      cursor: cursorId ? { id: cursorId } : undefined,
      where: { sessionId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    // Fetch all admins and superusers at once to create a complete name mapping for staff
    const staffMembers = await dbClient.user.findMany({
      where: { grade: { in: ['ADMIN', 'SUPERUSER'] } },
      select: { id: true, name: true },
    });

    const staffNameMapping = staffMembers.reduce(
      (mapping, staffMember) => {
        mapping[staffMember.id] = staffMember.name;
        return mapping;
      },
      {} as Record<string, string>,
    );

    sendMessage(safeConnection, {
      type: 'history',
      sessionId,
      messages: messages.map((message) => ({
        ...message,
        type: 'message',
        messageId: message.id,
        senderName: staffNameMapping[message.senderId],
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
 * Use for: session_status, read_receipts, etc.
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

    const { session, isParticipant } = await verifySessionParticipant(
      sessionId,
      safeConnection.userId,
      safeConnection.userGrade,
    );

    if (!session || !isParticipant) {
      console.error(
        filepath,
        `Unauthorized relay: User ${safeConnection.userId} not a participant in session ${sessionId}`,
      );
      return;
    }

    broadcastToSession(connections, adminConnections, session, parsed);
  } catch (error) {
    console.error(filepath, 'Error in session relay:', error);
  }
};

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
      // Sampled before the registry is touched: this is what tells a second
      // tab apart from a genuine arrival.
      const wasOnline = isUserOnline(connections, safeConnection.userId);
      const wasSupportOnline = adminConnections.size > 0;

      if (!connections.has(safeConnection.userId)) {
        connections.set(safeConnection.userId, new Set());
      }
      connections.get(safeConnection.userId)?.add(safeConnection);

      const isAdmin = isAdminGrade(safeConnection.userGrade);
      if (isAdmin) {
        adminConnections.add(safeConnection);
      }

      // Registered here, immediately after the registry add and before any
      // await below. A socket that dies while those DB queries are in flight
      // would otherwise emit 'close' with no listener attached, and nothing
      // would ever remove it: the ping sweep walks wsServer.clients, which ws
      // has already pruned, so the entry outlives the process's usefulness.
      // The result is a user pinned online forever -- or worse, an admin
      // pinned in adminConnections, telling every customer the support desk
      // is staffed when nobody is there.
      //
      // safeCloseConnection is idempotent (Set/Map deletes, and the presence
      // broadcasts are gated on the 1->0 transition), so an early attach costs
      // nothing if the connection closes normally later.
      safeConnection.on('close', () =>
        safeCloseConnection(1001, 'Offline: User Disconnected', safeConnection),
      );

      // Liveness bookkeeping for the ping sweep below.
      safeConnection.isAlive = true;
      safeConnection.on('pong', () => {
        safeConnection.isAlive = true;
      });

      // Snapshot before any delta, so the client has a baseline to apply
      // updates to rather than inferring one from the first transition.
      sendMessage(safeConnection, {
        type: 'presence_state',
        onlineUserIds: isAdmin ? getOnlineUserIds(connections) : [],
        supportOnline: adminConnections.size > 0,
      });

      if (!wasOnline) {
        broadcastPresenceToAdmins(
          adminConnections,
          safeConnection.userId,
          true,
        );
      }
      if (!wasSupportOnline && adminConnections.size > 0) {
        broadcastSupportPresence(connections, true);
      }

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
    }
  } catch (error) {
    console.error('Connection error:', error);
    safeCloseConnection(1008, 'Unauthorized: Connection failed', connection);
  }
});

/**
 * Liveness sweep.
 *
 * A socket can die without either side being told -- the phone drops off a
 * tower, a middlebox silently forgets the flow -- and TCP may take minutes to
 * work that out. Until it does, the connection sits in the registry and the
 * user reads as online, which is exactly the failure that makes a presence
 * indicator untrustworthy.
 *
 * Browsers answer ping frames in their WebSocket implementation, below the
 * page, so this needs no client code and works even on a wedged tab. The
 * interval doubles as a keepalive: 30s is comfortably under nginx's 60s
 * proxy_read_timeout, so idle chats stop being dropped by the proxy.
 */
const HEARTBEAT_INTERVAL_MS = 30_000;

const heartbeat = setInterval(() => {
  wsServer.clients.forEach((client) => {
    const connection = client as AuthenticatedConnection;

    if (connection.isAlive === false) {
      // Missed the previous round trip. terminate() emits 'close', so the
      // usual cleanup and presence broadcast run without a separate path.
      connection.terminate();
      return;
    }

    connection.isAlive = false;
    try {
      connection.ping();
    } catch (error) {
      console.error(filepath, 'Failed to ping connection:', error);
    }
  });
}, HEARTBEAT_INTERVAL_MS);

/**
 * Graceful shutdown.
 *
 * This used to hang the interval cleanup off `wsServer.on('close')`, which
 * only fires from an explicit `wsServer.close()` -- and nothing ever called
 * one, so the handler was decoration. A process manager restarting this
 * service sends SIGTERM, and without a handler the sockets die by TCP reset:
 * clients see an abnormal closure and enter reconnect backoff, rather than a
 * clean 1001 they can act on immediately.
 *
 * Closing the WebSocketServer walks its clients, which runs each connection's
 * 'close' handler, which is what empties the presence registry and lets the
 * remaining peers learn everyone went offline.
 */
const SHUTDOWN_GRACE_MS = 5_000;

let isShuttingDown = false;

const shutdown = (signal: string) => {
  // A second SIGTERM (or SIGINT from an impatient Ctrl-C) must not restart the
  // sequence and re-arm the force-exit timer.
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(filepath, `Received ${signal}, shutting down`);
  clearInterval(heartbeat);

  wsServer.clients.forEach((client) => {
    safeCloseConnection(1001, 'Server shutting down', client);
  });

  wsServer.close(() => server.close(() => process.exit(0)));

  // wsServer.close() waits for every client to acknowledge its close frame,
  // and a wedged peer -- the same half-open socket the heartbeat exists to
  // catch -- may never answer. Don't let one hold the restart hostage.
  setTimeout(() => {
    console.error(filepath, 'Shutdown grace period elapsed, forcing exit');
    process.exit(0);
  }, SHUTDOWN_GRACE_MS).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(port);
