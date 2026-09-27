import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, Messaging } from 'firebase/messaging';
import { v4 as uuidv4 } from 'uuid';
import { parseBridgeMessage } from '../nativeBridge';
import { getServiceWorkerRegistration, isWebView } from '../serviceWorker';
import { getFirebaseConfig } from './config';

// FCM storage keys for localStorage
export const FCM_TOKEN_STORAGE_KEY = 'fcm_token';
// Stores the userId of the user whose FCM token is currently registered.
// Used by both browser and WebView flows to avoid redundant re-registration.
export const FCM_TOKEN_REGISTERED_USER_KEY = 'fcm_token_registered_user_id';
// Key for storing the persistent unique device ID (UUID for web, hardware ID for app)
export const FCM_DEVICE_ID_KEY = 'fcm_device_id';
export const FCM_OPT_OUT_KEY = 'fcm_notifications_opt_out';
export const FCM_REGISTRATION_EVENT = 'fcm-registration-change';

export type EnableNotificationsResult =
  | 'enabled'
  | 'dismissed'
  | 'blocked'
  | 'failed';

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

function notifyRegistrationChange() {
  window.dispatchEvent(new Event(FCM_REGISTRATION_EVENT));
}

export function saveRegistration(token: string, userId: string): void {
  localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
  localStorage.setItem(FCM_TOKEN_REGISTERED_USER_KEY, userId);
  notifyRegistrationChange();
}

export function clearRegistration(): void {
  localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
  localStorage.removeItem(FCM_TOKEN_REGISTERED_USER_KEY);
  notifyRegistrationChange();
}

/**
 * Whether notifications are currently enabled on this device (token registered).
 */
export function isNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
}

function readOptedOutUsers(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(FCM_OPT_OUT_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setOptedOut(userId: string, optedOut: boolean): void {
  const others = readOptedOutUsers().filter((id) => id !== userId);
  const next = optedOut ? [...others, userId] : others;
  if (next.length) localStorage.setItem(FCM_OPT_OUT_KEY, JSON.stringify(next));
  else localStorage.removeItem(FCM_OPT_OUT_KEY);
}

export function isNotificationsOptedOut(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  return readOptedOutUsers().includes(userId);
}

export function isNotificationsSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (isWebView()) return true;
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  );
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

function getReactNativeWebView(): Promise<any> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    if ((window as any).ReactNativeWebView) {
      resolve((window as any).ReactNativeWebView);
      return;
    }
    let count = 0;
    const interval = setInterval(() => {
      count += 1;
      if ((window as any).ReactNativeWebView) {
        clearInterval(interval);
        resolve((window as any).ReactNativeWebView);
      } else if (count > 60) {
        // 3 seconds timeout
        clearInterval(interval);
        resolve(null);
      }
    }, 50);
  });
}

/**
 * Request native FCM token via React Native WebView bridge (Android only for now)
 * Used when running inside the mobile app WebView instead of browser FCM.
 */
export async function getNativeFCMTokenViaBridge(): Promise<{
  token: string;
  uniqueId: string;
} | null> {
  if (!isWebView()) {
    return null;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const rnWebView = await getReactNativeWebView();
  if (!rnWebView || typeof rnWebView.postMessage !== 'function') {
    console.warn('[FCM] ReactNativeWebView bridge not available');
    return null;
  }

  if (pendingNativeTokenPromise) {
    return pendingNativeTokenPromise;
  }

  pendingNativeTokenPromise = new Promise<{
    token: string;
    uniqueId: string;
  } | null>((resolve) => {
    function handler(event: MessageEvent) {
      const parsed = parseBridgeMessage(event.data);
      if (parsed?.type === 'FCM_TOKEN') {
        window.removeEventListener('message', handler);
        pendingNativeTokenPromise = null;
        resolve(
          parsed.payload?.token
            ? {
                token: parsed.payload.token as string,
                uniqueId: (parsed.payload.uniqueId as string) || '',
              }
            : null,
        );
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
    // Increased to 60s to account for potentially long user permission prompts or slow Play Services.
    setTimeout(() => {
      if (pendingNativeTokenPromise) {
        console.warn(
          '[FCM] Token request from WebView bridge timed out after 60s',
        );
        window.removeEventListener('message', handler);
        pendingNativeTokenPromise = null;
        resolve(null);
      }
    }, 60000);
  });

  return pendingNativeTokenPromise;
}
type NativePermissionStatus =
  | 'GRANTED'
  | 'NOT_DETERMINED'
  | 'DENIED'
  | 'BLOCKED';

function askNativePermission(
  request: 'CHECK' | 'REQUEST',
  fallback: NativePermissionStatus,
  timeoutMs: number,
): Promise<NativePermissionStatus> {
  if (!isWebView() || typeof window === 'undefined') {
    return Promise.resolve('DENIED');
  }

  const rnWebView = (window as any).ReactNativeWebView;
  if (!rnWebView) return Promise.resolve('DENIED');

  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let handler: (event: MessageEvent) => void = () => {};
    const finish = (status: NativePermissionStatus) => {
      window.removeEventListener('message', handler);
      clearTimeout(timer);
      resolve(status);
    };
    handler = (event: MessageEvent) => {
      const data = parseBridgeMessage(event.data);
      if (data?.type !== 'NOTIFICATION_PERMISSION_STATUS') return;
      const echoed = data.payload?.request;
      if (echoed && echoed !== request) return;
      finish(data.payload?.status ?? fallback);
    };
    window.addEventListener('message', handler);
    timer = setTimeout(() => finish(fallback), timeoutMs);
    try {
      rnWebView.postMessage(JSON.stringify({ type: `${request}_PERMISSION` }));
    } catch (err) {
      finish('DENIED');
    }
  });
}

export function getNativeNotificationPermissionStatus(): Promise<NativePermissionStatus> {
  return askNativePermission('CHECK', 'NOT_DETERMINED', 5000);
}

export async function requestNativeNotificationPermission(): Promise<
  'GRANTED' | 'DENIED' | 'BLOCKED'
> {
  const status = await askNativePermission('REQUEST', 'DENIED', 60000);
  if (status === 'GRANTED' || status === 'BLOCKED') return status;
  return 'DENIED';
}

export function openNativeNotificationSettings(): void {
  if (!isWebView() || typeof window === 'undefined') return;
  (window as any).ReactNativeWebView?.postMessage(
    JSON.stringify({ type: 'OPEN_NOTIFICATION_SETTINGS' }),
  );
}

export async function getPermissionState(): Promise<NotificationPermission> {
  if (typeof window === 'undefined') return 'denied';
  if (isWebView()) {
    const status = await getNativeNotificationPermissionStatus();
    if (status === 'GRANTED') return 'granted';
    return status === 'NOT_DETERMINED' ? 'default' : 'denied';
  }
  return getNotificationPermission() ?? 'denied';
}

export async function isNotificationsActive(): Promise<boolean> {
  if (!isNotificationsEnabled()) return false;
  const granted = (await getPermissionState()) === 'granted';
  return granted && isNotificationsEnabled();
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

  if (isNotificationsOptedOut(userId)) {
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
      saveRegistration(token, userId);
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

export async function requestNotificationsPermission(): Promise<EnableNotificationsResult> {
  if (typeof window === 'undefined') return 'failed';

  if (isWebView()) {
    const status = await requestNativeNotificationPermission();
    if (status === 'GRANTED') return 'enabled';
    return status === 'BLOCKED' ? 'blocked' : 'dismissed';
  }

  if (getNotificationPermission() === 'denied') return 'blocked';
  const permission = await requestNotificationPermission();
  if (permission === 'granted') return 'enabled';
  return permission === 'denied' ? 'blocked' : 'dismissed';
}

/**
 * Enable notifications on this device: request permission, then register the FCM
 * token. Shared by the profile Notifications toggle and reuses the same flow the
 * headless FcmManager runs.
 */
export async function enableNotifications(
  accessToken: string,
  userId: string,
): Promise<EnableNotificationsResult> {
  if (typeof window === 'undefined') return 'failed';
  const permission = await requestNotificationsPermission();
  if (permission !== 'enabled') return permission;
  setOptedOut(userId, false);

  if (isWebView()) {
    await ensureNativeFCMTokenRegisteredInWebView(userId, accessToken);
    return isNotificationsEnabled() ? 'enabled' : 'failed';
  }

  const token = await getFCMToken();
  if (!token) return 'failed';

  const registered = await registerFCMToken(
    token,
    accessToken,
    getDeviceInfo(),
  );
  if (!registered) return 'failed';
  saveRegistration(token, userId);
  return 'enabled';
}

/**
 * Disable notifications on this device: unregister the token and clear local FCM
 * state. Browser permission cannot be revoked programmatically.
 */
export async function disableNotifications(
  accessToken: string,
  userId: string,
): Promise<void> {
  if (typeof window === 'undefined') return;
  setOptedOut(userId, true);
  const token = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
  if (token) {
    try {
      await unregisterFCMToken(token, accessToken);
    } catch (error) {
      console.error('[FCM] Failed to unregister on disable:', error);
    }
  }
  clearRegistration();
}
