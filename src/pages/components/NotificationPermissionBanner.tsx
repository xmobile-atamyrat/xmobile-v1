import { isNative } from '@/lib/runtime';
import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  FCM_TOKEN_REGISTERED_KEY,
  FCM_TOKEN_STORAGE_KEY,
  getDeviceInfo,
  getFCMToken,
  hasNotificationPermission,
  initializeOrGetMessaging,
  registerFCMToken,
} from '@/pages/lib/fcm/fcmClient';
import { isWebView } from '@/pages/lib/serviceWorker';
import { notificationClasses } from '@/styles/classMaps/components/notifications';
import { interClassname } from '@/styles/theme';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import { MessagePayload, onMessage } from 'firebase/messaging';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function NotificationPermissionBanner() {
  const platform = usePlatform();
  const t = useTranslations();
  const { user, accessToken } = useUserContext();
  const { refreshUnreadCount } = useNotificationContext();
  const [dismissed, setDismissed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : null,
  );
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);

  /**
   * Initialize FCM: messaging, foreground handler, and token registration
   * Skips initialization in Capacitor (native mobile apps use native FCM)
   */
  const initializeFCM = useCallback(async () => {
    // Don't initialize FCM web in Capacitor - native apps use native FCM
    if (isNative()) {
      console.log('[FCM Banner] Skipping FCM web initialization in Capacitor');
      return false;
    }

    if (!user || !accessToken) {
      console.warn('[FCM Banner] Cannot initialize: user not logged in');
      return false;
    }

    if (!hasNotificationPermission()) {
      console.warn('[FCM Banner] Cannot initialize: permission not granted');
      return false;
    }

    if (initializedRef.current) {
      console.log('[FCM Banner] Already initialized, skipping');
      return true;
    }

    try {
      console.log('[FCM Banner] Starting FCM initialization...');

      // Initialize Firebase messaging
      const messaging = await initializeOrGetMessaging();
      if (!messaging) {
        console.warn('[FCM Banner] Messaging initialization returned null');
        return false;
      }

      console.log('[FCM Banner] Messaging instance created:', !!messaging);

      // Set up foreground message handler
      // This fires when app is in foreground and message is received
      const unsubscribe = onMessage(messaging, (payload: MessagePayload) => {
        console.log('[FCM Banner] ✅ Foreground message received:', payload);
        console.log('[FCM Banner] Message payload details:', {
          notification: payload.notification,
          data: payload.data,
        });
        refreshUnreadCount().catch((error) => {
          console.error('[FCM Banner] Failed to refresh unread count:', error);
        });
      });

      if (unsubscribe) {
        console.log(
          '[FCM Banner] ✅ Foreground handler registered successfully',
        );
        unsubscribeRef.current = unsubscribe;
      } else {
        console.error('[FCM Banner] ❌ Failed to register foreground handler');
        return false;
      }

      // Also listen for messages from service worker as fallback
      // Some browsers may route messages to service worker even in foreground
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const messageHandler = (event: MessageEvent) => {
          if (
            event.data &&
            event.data.type === 'FCM_FOREGROUND_MESSAGE' &&
            event.data.payload
          ) {
            console.log(
              '[FCM Banner] ✅ Received FCM message via service worker:',
              event.data.payload,
            );
            refreshUnreadCount().catch((error) => {
              console.error(
                '[FCM Banner] Failed to refresh unread count:',
                error,
              );
            });
          }
        };

        navigator.serviceWorker.addEventListener('message', messageHandler);
        console.log('[FCM Banner] ✅ Service worker message listener added');

        // Store handler for cleanup
        (unsubscribeRef.current as any).swMessageHandler = messageHandler;
      }

      // Get FCM token
      const token = await getFCMToken();
      if (!token) {
        console.error('[FCM Banner] Failed to get FCM token');
        return false;
      }

      // Check if token exists in localStorage
      const storedToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);

      // Register token if it doesn't exist or is different
      if (!storedToken || storedToken !== token) {
        const registered = await registerFCMToken(
          token,
          accessToken,
          getDeviceInfo(),
        );

        if (registered) {
          localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
          localStorage.setItem(FCM_TOKEN_REGISTERED_KEY, 'true');
          console.log('[FCM Banner] ✅ Token registered successfully');
        } else {
          console.error('[FCM Banner] Failed to register token');
          return false;
        }
      } else {
        console.log('[FCM Banner] Token already registered');
      }

      initializedRef.current = true;
      return true;
    } catch (error) {
      console.error('[FCM Banner] Initialization error:', error);
      return false;
    }
  }, [user, accessToken, refreshUnreadCount]);

  /**
   * Auto-initialize FCM if user is logged in and permission is already granted
   */
  useEffect(() => {
    if (!user || !accessToken) {
      // Clean up if user logs out
      if (unsubscribeRef.current) {
        if (typeof unsubscribeRef.current === 'function') {
          unsubscribeRef.current();
        }
        if (
          'serviceWorker' in navigator &&
          navigator.serviceWorker.controller &&
          (unsubscribeRef.current as any).swMessageHandler
        ) {
          navigator.serviceWorker.removeEventListener(
            'message',
            (unsubscribeRef.current as any).swMessageHandler,
          );
        }
        unsubscribeRef.current = null;
      }
      initializedRef.current = false;
      return;
    }

    // Auto-initialize if permission is already granted
    if (hasNotificationPermission()) {
      initializeFCM().catch((error) => {
        console.error('[FCM Banner] Auto-initialization failed:', error);
      });
    }

    // Cleanup on unmount
    // eslint-disable-next-line consistent-return
    return () => {
      if (unsubscribeRef.current) {
        // Unsubscribe from onMessage
        if (typeof unsubscribeRef.current === 'function') {
          unsubscribeRef.current();
        }
        // Remove service worker message listener
        if (
          'serviceWorker' in navigator &&
          navigator.serviceWorker.controller &&
          (unsubscribeRef.current as any).swMessageHandler
        ) {
          navigator.serviceWorker.removeEventListener(
            'message',
            (unsubscribeRef.current as any).swMessageHandler,
          );
        }
        unsubscribeRef.current = null;
      }
    };
  }, [user, accessToken, initializeFCM]);

  const requestPermission = useCallback(async () => {
    if (!t) return;
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      typeof Notification === 'undefined'
    ) {
      console.warn('This browser does not support notifications');
      return;
    }

    try {
      // Request permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        setDismissed(true);
        // Initialize FCM after permission is granted
        const success = await initializeFCM();
        if (success) {
          // Show a test notification to confirm it works
          try {
            const testNotification = new Notification('Уведомления включены', {
              body: 'Вы будете получать уведомления о новых сообщениях.',
              icon: '/xm-logo.png',
              tag: 'Тестовые уведомления',
            });
            setTimeout(() => testNotification.close(), 3000);
          } catch (error) {
            console.error('Failed to show test notification:', error);
          }
        }
      } else if (result === 'denied') {
        // Permission was denied, show snackbar
        setSnackbarMessage(t('notificationsDenied'));
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    }
  }, [t, initializeFCM]);

  // Don't show if:
  // - User not logged in
  // - Already dismissed
  // - Permission already granted or denied
  // - Notifications not supported
  // - Running in WebView or Capacitor (native app handles notifications)
  if (
    !user ||
    !accessToken ||
    dismissed ||
    permission === 'granted' ||
    permission === 'denied' ||
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    isWebView() ||
    isNative()
  ) {
    return null;
  }

  return (
    <>
      <Box className={notificationClasses.permissionBanner.container[platform]}>
        <Typography
          className={`${notificationClasses.permissionBanner.text[platform]} ${interClassname.className}`}
        >
          {t('enableNotifications')}
        </Typography>
        <Box className="flex items-center gap-[8px]">
          <Typography
            onClick={requestPermission}
            className={`${notificationClasses.permissionBanner.button[platform]} ${interClassname.className}`}
          >
            {t('enable')}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setDismissed(true)}
            className="p-1"
          >
            <CloseIcon className="w-[16px] h-[16px] text-[#856404]" />
          </IconButton>
        </Box>
      </Box>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          setSnackbarOpen(false);
        }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="warning"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
}
