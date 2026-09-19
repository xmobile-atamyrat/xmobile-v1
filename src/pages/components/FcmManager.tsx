import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  FCM_TOKEN_REGISTERED_USER_KEY,
  FCM_TOKEN_STORAGE_KEY,
  getDeviceInfo,
  getFCMToken,
  getNativeNotificationPermissionStatus,
  hasNotificationPermission,
  initializeOrGetMessaging,
  registerFCMToken,
} from '@/pages/lib/fcm/fcmClient';
import { isWebView } from '@/pages/lib/serviceWorker';
import { MessagePayload, onMessage } from 'firebase/messaging';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Headless FCM lifecycle manager (renders nothing).
 *
 * Formerly NotificationPermissionBanner — the "enable notifications" banner UI
 * was removed platform-wide; enabling/disabling now lives on the profile page
 * (see enableNotifications/disableNotifications in fcmClient). This component
 * keeps the still-needed background wiring: once permission is already granted,
 * it registers the FCM token and attaches the foreground message handler that
 * refreshes the unread count.
 */
export default function FcmManager(): null {
  const { user, accessToken } = useUserContext();
  const { refreshUnreadCount } = useNotificationContext();
  const [permission, setPermission] = useState<NotificationPermission | null>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : null,
  );
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const swMessageHandlerRef = useRef<((event: MessageEvent) => void) | null>(
    null,
  );
  const initializedRef = useRef(false);

  const initializeFCM = useCallback(async () => {
    if (!user || !accessToken) return false;
    if (!isWebView() && !hasNotificationPermission()) return false;
    if (initializedRef.current) return true;

    try {
      const messaging = await initializeOrGetMessaging();
      if (!messaging) return false;

      const unsubscribe = onMessage(messaging, (payload: MessagePayload) => {
        console.log('[FCM] Foreground message received:', payload);
        refreshUnreadCount().catch((error) => {
          console.error('[FCM] Failed to refresh unread count:', error);
        });
      });

      if (unsubscribe) {
        unsubscribeRef.current = unsubscribe;
      } else {
        return false;
      }

      // Some browsers route foreground messages through the service worker.
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const messageHandler = (event: MessageEvent) => {
          if (
            event.data &&
            event.data.type === 'FCM_FOREGROUND_MESSAGE' &&
            event.data.payload
          ) {
            refreshUnreadCount().catch((error) => {
              console.error('[FCM] Failed to refresh unread count:', error);
            });
          }
        };
        navigator.serviceWorker.addEventListener('message', messageHandler);
        swMessageHandlerRef.current = messageHandler;
      }

      const token = await getFCMToken();
      if (!token) return false;

      const storedToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
      if (!storedToken || storedToken !== token) {
        const registered = await registerFCMToken(
          token,
          accessToken,
          getDeviceInfo(),
        );
        if (registered) {
          localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
          localStorage.setItem(FCM_TOKEN_REGISTERED_USER_KEY, user.id);
        } else {
          return false;
        }
      }

      initializedRef.current = true;
      return true;
    } catch (error) {
      console.error('[FCM] Initialization error:', error);
      return false;
    }
  }, [user, accessToken, refreshUnreadCount]);

  // Auto-initialize when logged in and permission is already granted.
  useEffect(() => {
    if (!user || !accessToken) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (
        swMessageHandlerRef.current &&
        'serviceWorker' in navigator &&
        navigator.serviceWorker.controller
      ) {
        navigator.serviceWorker.removeEventListener(
          'message',
          swMessageHandlerRef.current,
        );
        swMessageHandlerRef.current = null;
      }
      initializedRef.current = false;
      return undefined;
    }

    if (
      hasNotificationPermission() ||
      (isWebView() && permission === 'granted')
    ) {
      initializeFCM().catch((error) => {
        console.error('[FCM] Auto-initialization failed:', error);
      });
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (
        swMessageHandlerRef.current &&
        'serviceWorker' in navigator &&
        navigator.serviceWorker.controller
      ) {
        navigator.serviceWorker.removeEventListener(
          'message',
          swMessageHandlerRef.current,
        );
        swMessageHandlerRef.current = null;
      }
    };
  }, [user, accessToken, initializeFCM, permission]);

  // WebView: fetch native permission status so auto-init can run.
  useEffect(() => {
    if (isWebView() && user) {
      getNativeNotificationPermissionStatus().then((status) => {
        setPermission(status === 'GRANTED' ? 'granted' : 'denied');
        if (status === 'GRANTED') initializeFCM();
      });
    }
  }, [user, initializeFCM]);

  return null;
}
