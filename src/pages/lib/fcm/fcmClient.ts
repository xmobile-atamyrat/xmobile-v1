import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  MessagePayload,
  Messaging,
  onMessage,
} from 'firebase/messaging';
import { getServiceWorkerRegistration, isWebView } from '../serviceWorker';
import { getFirebaseConfig } from './config';

let firebaseApp: FirebaseApp | null = null;
let messaging: Messaging | null = null;

/**
 * Send Firebase config to service worker
 * Service workers can't access environment variables directly
 */
async function sendConfigToServiceWorker(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      const config = getFirebaseConfig();
      registration.active.postMessage({
        type: 'FIREBASE_CONFIG',
        config,
      });
    }
  } catch (error) {
    console.error('[FCM] Failed to send config to service worker:', error);
  }
}

/**
 * Initialize Firebase app (singleton)
 */
export function initializeFirebaseApp(): FirebaseApp {
  if (firebaseApp) {
    return firebaseApp;
  }

  const existingApp = getApps()[0];
  if (existingApp) {
    firebaseApp = existingApp;
    return firebaseApp;
  }

  const config = getFirebaseConfig();
  firebaseApp = initializeApp(config);
  return firebaseApp;
}

/**
 * Initialize Firebase Messaging (singleton)
 * Returns null if not supported (WebView, etc.)
 */
export async function initializeMessaging(): Promise<Messaging | null> {
  // Don't initialize in WebView
  if (isWebView()) {
    console.log('[FCM] Skipping initialization in WebView');
    return null;
  }

  if (messaging) {
    return messaging;
  }

  try {
    const app = initializeFirebaseApp();

    // Check if messaging is supported
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[FCM] Notifications not supported in this environment');
      return null;
    }

    // Send config to service worker
    await sendConfigToServiceWorker();

    messaging = getMessaging(app);
    return messaging;
  } catch (error) {
    console.error('[FCM] Failed to initialize messaging:', error);
    return null;
  }
}

/**
 * Get FCM token for the current device
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    const messagingInstance = await initializeMessaging();
    if (!messagingInstance) {
      return null;
    }

    // Get service worker registration
    // Use navigator.serviceWorker.ready to get the active registration
    // This works with any registered service worker
    let registration = getServiceWorkerRegistration();
    if (!registration) {
      // Wait for service worker to be ready
      registration = await navigator.serviceWorker.ready;
    }

    if (!registration) {
      console.warn('[FCM] Service worker not registered');
      return null;
    }

    // Get VAPID key from environment
    // VAPID key is required for FCM web push
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn(
        '[FCM] VAPID key not found. Please set NEXT_PUBLIC_FIREBASE_VAPID_KEY environment variable.',
      );
      return null;
    }

    const token = await getToken(messagingInstance, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    return token;
  } catch (error) {
    console.error('[FCM] Failed to get FCM token:', error);
    return null;
  }
}

/**
 * Register FCM token with the server
 */
export async function registerFCMToken(
  token: string,
  accessToken: string,
  deviceInfo: string,
): Promise<boolean> {
  try {
    const response = await fetch('/api/fcm/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        token,
        deviceInfo,
      }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('[FCM] Failed to register token:', error);
    return false;
  }
}

/**
 * Unregister FCM token from the server
 */
export async function unregisterFCMToken(
  token: string,
  accessToken: string,
): Promise<boolean> {
  try {
    const response = await fetch('/api/fcm/token', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('[FCM] Failed to unregister token:', error);
    return false;
  }
}

/**
 * Deactivate all FCM tokens for the current user (soft delete on logout)
 */
export async function deactivateAllTokens(
  accessToken: string,
): Promise<boolean> {
  try {
    const response = await fetch('/api/fcm/token', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('[FCM] Failed to deactivate tokens:', error);
    return false;
  }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Check if notification permission is granted
 */
export function hasNotificationPermission(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  return Notification.permission === 'granted';
}

/**
 * Get notification permission status
 */
export function getNotificationPermission(): NotificationPermission | null {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }
  return Notification.permission;
}

/**
 * Set up message handler for foreground notifications
 */
export function onForegroundMessage(
  callback: (payload: MessagePayload) => void,
): (() => void) | null {
  if (isWebView()) {
    return null;
  }

  let unsubscribe: (() => void) | null = null;

  initializeMessaging()
    .then((messagingInstance) => {
      if (messagingInstance) {
        unsubscribe = onMessage(messagingInstance, callback);
      }
    })
    .catch((error) => {
      console.error(
        '[FCM] Failed to set up foreground message handler:',
        error,
      );
    });

  return unsubscribe || null;
}

/**
 * Get device info for token registration
 */
export function getDeviceInfo(): string {
  if (typeof navigator === 'undefined') {
    return 'Unknown';
  }

  const info = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
  };

  return JSON.stringify(info);
}
