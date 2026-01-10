import dbClient from '@/lib/dbClient';
import { NotificationType } from '@prisma/client';
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { FCMNotificationPayload, FCMSendResult } from './types';

let firebaseApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase(): admin.app.App {
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

  const credentialsPath =
    process.env.FIREBASE_ADMIN_SDK_PATH ||
    path.join(
      process.cwd(),
      'fcm',
      'xmobile-54bc9-firebase-adminsdk-fbsvc-d665c5ae1a.json',
    );

  try {
    const serviceAccountData = fs.readFileSync(credentialsPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountData);

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
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
        isActive: true,
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
 * Mark FCM token as inactive
 */
export async function markFCMTokenInactive(
  tokenId: string,
  reason: string,
): Promise<void> {
  try {
    await dbClient.fCMToken.update({
      where: { id: tokenId },
      data: {
        isActive: false,
        lastFailedAt: new Date(),
      },
    });
    console.log(
      `[FCM Service] Marked token ${tokenId} as inactive. Reason: ${reason}`,
    );
  } catch (error) {
    console.error(
      `[FCM Service] Failed to mark token ${tokenId} as inactive:`,
      error,
    );
  }
}

/**
 * Update FCM token usage statistics
 */
export async function updateFCMTokenUsage(
  tokenId: string,
  success: boolean,
): Promise<void> {
  try {
    if (success) {
      await dbClient.fCMToken.update({
        where: { id: tokenId },
        data: {
          lastUsedAt: new Date(),
          failureCount: 0,
        },
      });
    } else {
      const token = await dbClient.fCMToken.findUnique({
        where: { id: tokenId },
        select: { failureCount: true },
      });

      const newFailureCount = (token?.failureCount || 0) + 1;
      const failureThreshold = parseInt(
        process.env.FCM_FAILURE_THRESHOLD || '3',
        10,
      );

      await dbClient.fCMToken.update({
        where: { id: tokenId },
        data: {
          lastFailedAt: new Date(),
          failureCount: newFailureCount,
          isActive: newFailureCount < failureThreshold,
        },
      });
    }
  } catch (error) {
    console.error(
      `[FCM Service] Failed to update token usage for ${tokenId}:`,
      error,
    );
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
    const app = initializeFirebase();
    const messaging = admin.messaging(app);

    // Get active tokens for user
    const tokens = await getActiveFCMTokensForUser(userId);

    if (tokens.length === 0) {
      return {
        success: false,
        tokensSent: 0,
        tokensFailed: 0,
        failedTokenIds: [],
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
        ...(notification.data.sessionId && {
          sessionId: notification.data.sessionId,
        }),
        ...(notification.data.orderId && {
          orderId: notification.data.orderId,
        }),
      },
      tokens: tokenStrings,
    };

    // Send notification
    const response = await messaging.sendEachForMulticast(message);

    // Process results
    const failedTokenIds: string[] = [];
    let tokensSent = 0;
    let tokensFailed = 0;

    response.responses.forEach((resp, idx) => {
      const tokenId = tokens[idx].id;
      const token = tokenStrings[idx];

      if (resp.success) {
        tokensSent += 1;
        updateFCMTokenUsage(tokenId, true).catch(console.error);
      } else {
        tokensFailed += 1;
        const error = resp.error;

        // Handle specific FCM errors
        if (
          error?.code === 'messaging/invalid-registration-token' ||
          error?.code === 'messaging/registration-token-not-registered'
        ) {
          markFCMTokenInactive(tokenId, error.code).catch(console.error);
          failedTokenIds.push(tokenId);
        } else {
          updateFCMTokenUsage(tokenId, false).catch(console.error);
          failedTokenIds.push(tokenId);
        }

        console.error(
          `[FCM Service] Failed to send to token ${token.substring(0, 20)}...:`,
          error?.message || 'Unknown error',
        );
      }
    });

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
 * Send notification with FCM first, then fallback to WebSocket server if FCM fails
 * This is used from Next.js API routes
 */
export async function sendNotificationWithFCMFallback(
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
      return true;
    }

    // FCM failed, try WebSocket fallback
    const wsResult = await sendToWebSocketServer(targetUserId, [notification]);
    return wsResult;
  } catch (error) {
    console.error(
      `[FCM Service] Error sending notification ${notification.id} to user ${targetUserId}:`,
      error,
    );
    // Try WebSocket as last resort
    try {
      return await sendToWebSocketServer(targetUserId, [notification]);
    } catch (wsError) {
      console.error(
        `[FCM Service] WebSocket fallback also failed for notification ${notification.id}:`,
        wsError,
      );
      return false;
    }
  }
}
