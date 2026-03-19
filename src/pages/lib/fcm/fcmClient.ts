import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, Messaging } from 'firebase/messaging';
import { v4 as uuidv4 } from 'uuid';
import { getServiceWorkerRegistration, isWebView } from '../serviceWorker';
import { getFirebaseConfig } from './config';

// FCM storage keys for localStorage
export const FCM_TOKEN_STORAGE_KEY = 'fcm_token';
// Stores the userId of the user whose FCM token is currently registered.
// Used by both browser and WebView flows to avoid redundant re-registration.
export const FCM_TOKEN_REGISTERED_USER_KEY = 'fcm_token_registered_user_id';
// Key for storing the persistent unique device ID (UUID for web, hardware ID for app)
export const FCM_DEVICE_ID_KEY = 'fcm_device_id';

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
export function initializeOrGetFirebaseApp(): FirebaseApp {
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
export async function initializeOrGetMessaging(): Promise<Messaging | null> {
  // Don't initialize in WebView
  if (isWebView()) {
    console.log('[FCM] Skipping initialization in WebView');
    return null;
  }

  if (messaging) {
    return messaging;
  }

  try {
    const app = initializeOrGetFirebaseApp();

    // Check if messaging is supported
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[FCM] Notifications not supported in this environment');
      return null;
    }

    // CRITICAL FOR FIREFOX/MOBILE: Wait for service worker to be ready
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        console.log(
          '[FCM] Service worker ready:',
          registration.active?.state,
          registration.scope,
        );
      } catch (swError) {
        console.warn('[FCM] Service worker not ready:', swError);
        // Continue anyway, but might fail on Firefox
      }
    }

    // Send config to service worker
    await sendConfigToServiceWorker();

    messaging = getMessaging(app);
    console.log('[FCM] Messaging instance created successfully');
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
    const messagingInstance = await initializeOrGetMessaging();
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
 * Get device info for token registration.
 * Generates or retrieves a persistent unique ID to prevent collisions.
 */
export function getDeviceInfo(hardwareId?: string): string {
  if (typeof window === 'undefined') {
    return 'Unknown';
  }

  // If hardwareId is provided (from WebView bridge), use it
  // Check localStorage for existing persistent device ID
  // Generate a new UUID if not found
  if (hardwareId) {
    return `APP:${hardwareId}`;
  }

  let deviceId = localStorage.getItem(FCM_DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem(FCM_DEVICE_ID_KEY, deviceId);
  }

  return `WEB:${deviceId}`;
}

let pendingNativeTokenPromise: Promise<{
  token: string;
  uniqueId: string;
} | null> | null = null;

/**
 * Request native FCM token via React Native WebView bridge (Android only for now)
 * Used when running inside the mobile app WebView instead of browser FCM.
 */
export function getNativeFCMTokenViaBridge(): Promise<{
  token: string;
  uniqueId: string;
} | null> {
  if (!isWebView()) {
    return Promise.resolve(null);
  }

  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  const rnWebView = (window as any).ReactNativeWebView;
  if (!rnWebView || typeof rnWebView.postMessage !== 'function') {
    console.warn('[FCM] ReactNativeWebView bridge not available');
    return Promise.resolve(null);
  }

  if (pendingNativeTokenPromise) {
    return pendingNativeTokenPromise;
  }

  pendingNativeTokenPromise = new Promise<{
    token: string;
    uniqueId: string;
  } | null>((resolve) => {
    function handler(event: MessageEvent) {
      try {
        const rawData = event.data;
        const parsed =
          typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

        if (parsed && parsed.type === 'FCM_TOKEN' && parsed.payload?.token) {
          window.removeEventListener('message', handler);
          pendingNativeTokenPromise = null;
          resolve({
            token: parsed.payload.token as string,
            uniqueId: (parsed.payload.uniqueId as string) || '',
          });
        }
      } catch (error) {
        if (
          typeof event.data === 'string' &&
          event.data.includes('FCM_TOKEN')
        ) {
          console.error(
            '[FCM] Failed to parse expected FCM message from WebView bridge:',
            error,
          );
        }
      }
    }

    window.addEventListener('message', handler);

    // Send request to native layer
    try {
      rnWebView.postMessage(
        JSON.stringify({
          type: 'REQUEST_FCM_TOKEN',
        }),
      );
    } catch (error) {
      console.error('[FCM] Failed to post REQUEST_FCM_TOKEN to native:', error);
      window.removeEventListener('message', handler);
      pendingNativeTokenPromise = null;
      resolve(null);
      return;
    }

    // Safety timeout: if no response, resolve with null
    setTimeout(() => {
      if (pendingNativeTokenPromise) {
        console.warn('[FCM] Token request from WebView bridge timed out');
        window.removeEventListener('message', handler);
        pendingNativeTokenPromise = null;
        resolve(null);
      }
    }, 10000);
  });

  return pendingNativeTokenPromise;
}

/**
 * Ensure native FCM token is registered when running inside WebView.
 * Reuses existing /api/fcm/token endpoint and storage keys without schema changes.
 */
export async function ensureNativeFCMTokenRegisteredInWebView(
  userId: string,
  accessToken: string,
): Promise<void> {
  if (!isWebView()) {
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }

  try {
    const existingToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    const registeredUserId = localStorage.getItem(
      FCM_TOKEN_REGISTERED_USER_KEY,
    );

    const bridgeData = await getNativeFCMTokenViaBridge();
    if (!bridgeData || !bridgeData.token) {
      console.warn('[FCM] No native FCM token received in WebView');
      return;
    }

    const { token, uniqueId } = bridgeData;

    if (existingToken === token && registeredUserId === userId) {
      console.log(
        '[FCM] Native FCM token already registered for this user (WebView)',
      );
      return;
    }

    const registered = await registerFCMToken(
      token,
      accessToken,
      getDeviceInfo(uniqueId),
    );

    if (registered) {
      localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
      localStorage.setItem(FCM_TOKEN_REGISTERED_USER_KEY, userId);
      console.log('[FCM] Native FCM token registered successfully (WebView)');
    } else {
      console.error('[FCM] Failed to register native FCM token (WebView)');
    }
  } catch (error) {
    console.error(
      '[FCM] Error while registering native FCM token in WebView:',
      error,
    );
  }
}
