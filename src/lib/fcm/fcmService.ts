import dbClient from '@/lib/dbClient';
import { NotificationType, Prisma } from '@prisma/client';
import * as admin from 'firebase-admin';
import fs from 'fs';
import { createOAuth2GoogleapisCredential } from './credential';
import { FCMNotificationPayload, FCMSendResult } from './types';

let firebaseApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK
 */
function initializeOrGetFirebaseApp(): admin.app.App {
  if (firebaseApp) {
    return firebaseApp;
  }

  // Check if app already exists
  try {
    const existingApp = admin.app();
    if (existingApp) {
      firebaseApp = existingApp;
      return firebaseApp;
    }
  } catch (error) {
    // App doesn't exist, continue to initialize
  }

  const credentialsPath = process.env.FIREBASE_ADMIN_SDK_PATH;

  if (!credentialsPath) {
    throw new Error(
      '[FCM Service] FIREBASE_ADMIN_SDK_PATH environment variable is not defined. Cannot initialize Firebase Admin SDK.',
    );
  }

  try {
    const serviceAccountData = fs.readFileSync(credentialsPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountData);

    // NOTE: we deliberately do NOT use `admin.credential.cert()`. Its token
    // minting goes to `www.googleapis.com`, which is blocked (DNS sinkhole +
    // SNI filtering) on the Telekom VM. Our credential mints at
    // `oauth2.googleapis.com` instead. Because a custom credential does not
    // carry the project id, we pass `projectId` explicitly so the messaging
    // send URL (fcm.googleapis.com/v1/projects/<id>/messages:send) is built.
    // See src/lib/fcm/credential.ts for the full network context.
    firebaseApp = admin.initializeApp({
      credential: createOAuth2GoogleapisCredential(serviceAccount),
      projectId: serviceAccount.project_id,
    });

    console.log('[FCM Service] Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error: any) {
    // If app already exists error, try to get existing app
    if (
      error?.code === 'app/invalid-app-options' ||
      error?.code === 'app/duplicate-app'
    ) {
      try {
        firebaseApp = admin.app();
        return firebaseApp;
      } catch (getAppError) {
        console.error(
          '[FCM Service] Failed to get existing Firebase app:',
          getAppError,
        );
      }
    }
    console.error(
      '[FCM Service] Failed to initialize Firebase Admin SDK:',
      error,
    );
    throw error;
  }
}

/**
 * Get active FCM tokens for a user
 */
export async function getActiveFCMTokensForUser(
  userId: string,
): Promise<Array<{ id: string; token: string }>> {
  try {
    const tokens = await dbClient.fCMToken.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        token: true,
      },
    });

    return tokens;
  } catch (error) {
    console.error(
      `[FCM Service] Failed to get tokens for user ${userId}:`,
      error,
    );
    return [];
  }
}

/**
 * Send FCM notification to a user
 */
export async function sendFCMNotificationToUser(
  userId: string,
  notification: FCMNotificationPayload,
): Promise<FCMSendResult> {
  try {
    const app = initializeOrGetFirebaseApp();
    const messaging = admin.messaging(app);

    // Get active tokens for user
    const tokens = await getActiveFCMTokensForUser(userId);

    if (tokens.length === 0) {
      return {
        success: false,
        tokensSent: 0,
        tokensFailed: 0,
        failedTokenIds: [],
        noTokens: true,
      };
    }

    const tokenStrings = tokens.map((t) => t.token);

    // Prepare FCM message
    const message: admin.messaging.MulticastMessage = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        notificationId: notification.data.notificationId,
        type: notification.data.type,
        click_action: notification.data.click_action,
        title: notification.title,
        body: notification.body,
        ...(notification.data.sessionId && {
          sessionId: notification.data.sessionId,
        }),
        ...(notification.data.orderId && {
          orderId: notification.data.orderId,
        }),
      },
      android: {
        priority: 'high',
        ttl: 24 * 60 * 60 * 1000,
        notification: {
          channelId: 'xmobile_notifications',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      tokens: tokenStrings,
    };

    // Send notification
    const response = await messaging.sendEachForMulticast(message);

    // Process results
    const failedTokenIds: string[] = [];
    let tokensSent = 0;
    let tokensFailed = 0;

    const tokensToDelete: string[] = [];

    response.responses.forEach((resp, idx) => {
      const token = tokenStrings[idx];
      const tokenRecord = tokens[idx];

      if (resp.success) {
        tokensSent += 1;
      } else {
        tokensFailed += 1;
        if (tokenRecord) failedTokenIds.push(tokenRecord.id);
        const error = resp.error;

        if (
          error?.code === 'messaging/invalid-registration-token' ||
          error?.code === 'messaging/registration-token-not-registered'
        ) {
          if (tokenRecord) tokensToDelete.push(tokenRecord.token);
        }

        console.error(
          `[FCM Service] Failed to send to token ${token.substring(0, 20)}...:`,
          error?.message || 'Unknown error',
        );
      }
    });

    if (tokensToDelete.length > 0) {
      try {
        await dbClient.fCMToken.deleteMany({
          where: { token: { in: tokensToDelete } },
        });
        console.log(
          `[FCM Service] Deleted ${tokensToDelete.length} stale FCM token(s)`,
        );
      } catch (dbError) {
        console.error(
          '[FCM Service] Failed to delete stale FCM tokens:',
          dbError,
        );
      }
    }

    return {
      success: tokensSent > 0,
      tokensSent,
      tokensFailed,
      failedTokenIds,
    };
  } catch (error) {
    console.error(
      `[FCM Service] Failed to send FCM notification to user ${userId}:`,
      error,
    );
    return {
      success: false,
      tokensSent: 0,
      tokensFailed: 0,
      failedTokenIds: [],
    };
  }
}

/**
 * Create FCM notification payload from InAppNotification
 */
export function createFCMNotificationPayload(
  notification: {
    id: string;
    type: NotificationType;
    title?: string | null;
    content: string;
    sessionId?: string | null;
    orderId?: string | null;
  },
  baseUrl: string = process.env.NEXT_PUBLIC_BASE_URL ||
    'https://xmobile.com.tm',
): FCMNotificationPayload {
  let clickAction = `${baseUrl}/chat`;

  if (notification.type === 'CHAT_MESSAGE' && notification.sessionId) {
    clickAction = `${baseUrl}/chat?sessionId=${notification.sessionId}`;
  } else if (
    notification.type === 'ORDER_STATUS_UPDATE' &&
    notification.orderId
  ) {
    clickAction = `${baseUrl}/orders/${notification.orderId}`;
  }

  return {
    title: notification.title || 'Уведомление',
    body: notification.content,
    data: {
      notificationId: notification.id,
      type: notification.type,
      click_action: clickAction,
      ...(notification.sessionId && { sessionId: notification.sessionId }),
      ...(notification.orderId && { orderId: notification.orderId }),
    },
  };
}

/**
 * updateMany with 3 attempts (200ms·n backoff); never throws, logs on final
 * failure. A delivery-status write that never lands leaves the row PENDING,
 * so the batch job re-sends a push the user already got — worth retrying a
 * couple of likely-transient DB blips. updateMany (vs update) also makes a
 * row deleted mid-flight a no-op instead of a P2025 throw.
 */
export async function updateNotificationWithRetry(
  where: Prisma.InAppNotificationWhereInput,
  data: Prisma.InAppNotificationUpdateManyMutationInput,
): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await dbClient.inAppNotification.updateMany({ where, data });
      return;
    } catch (error) {
      if (attempt === 3) {
        console.error(
          `[FCM Service] Failed to update notification status (${JSON.stringify(where)}) after ${attempt} attempts:`,
          error,
        );
        return;
      }
      await new Promise((r) => {
        setTimeout(r, 200 * attempt);
      });
    }
  }
}

/**
 * Record the outcome of a send attempt on the InAppNotification row so the
 * batch-runner retry job (scripts/batch-runner/jobs/notification-retry.ts) can
 * pick up anything that didn't reach the user. `delivered` = FCM accepted OR
 * WS fallback delivered. Failures land as PENDING (nextRetryAt=null) so the job
 * retries on its next tick.
 */
export async function recordNotificationDelivery(
  notificationId: string,
  delivered: boolean,
): Promise<void> {
  const data = {
    lastAttemptAt: new Date(),
    deliveryStatus: (delivered ? 'SENT' : 'PENDING') as 'SENT' | 'PENDING',
  };

  // The inline send and the batch retry job can race on the same row (e.g. a
  // slow FCM call still in flight when the retry job's next tick picks the
  // same PENDING row up). A failed attempt must never downgrade a row the
  // other side already marked SENT, or a real delivery gets endlessly
  // re-retried (and can even end up reported as permanently failed) despite
  // already having reached the user. Only the successful case is allowed to
  // write unconditionally.
  const where = delivered
    ? { id: notificationId }
    : { id: notificationId, deliveryStatus: { not: 'SENT' as const } };

  await updateNotificationWithRetry(where, data);
}

/**
 * Send notification with FCM first, then fallback to WebSocket server if FCM fails
 * This is used from Next.js API routes
 */
export async function sendFCMWithCallbackFallback(
  targetUserId: string,
  notification: {
    id: string;
    type: NotificationType;
    title?: string | null;
    content: string;
    sessionId?: string | null;
    orderId?: string | null;
  },
  sendToWebSocketServer: (
    userId: string,
    notifications: any[],
  ) => Promise<boolean>,
): Promise<boolean> {
  try {
    // Try FCM first
    const fcmPayload = createFCMNotificationPayload(notification);
    const fcmResult = await sendFCMNotificationToUser(targetUserId, fcmPayload);

    if (fcmResult.success && fcmResult.tokensSent > 0) {
      // FCM succeeded
      await recordNotificationDelivery(notification.id, true);
      return true;
    }

    // FCM failed, try WebSocket fallback
    const wsResult = await sendToWebSocketServer(targetUserId, [notification]);
    await recordNotificationDelivery(notification.id, wsResult);
    return wsResult;
  } catch (error) {
    console.error(
      `[FCM Service] Error sending notification ${notification.id} to user ${targetUserId}:`,
      error,
    );
    // Try WebSocket as last resort
    try {
      const wsResult = await sendToWebSocketServer(targetUserId, [
        notification,
      ]);
      await recordNotificationDelivery(notification.id, wsResult);
      return wsResult;
    } catch (wsError) {
      console.error(
        `[FCM Service] WebSocket fallback also failed for notification ${notification.id}:`,
        wsError,
      );
      return false;
    }
  }
}
