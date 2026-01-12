import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { MessagePayload, onMessage } from 'firebase/messaging';
import { ReactNode, useEffect, useRef } from 'react';
import {
  getDeviceInfo,
  getFCMToken,
  hasNotificationPermission,
  initializeOrGetMessaging,
  registerFCMToken,
} from './fcmClient';
import { FCM_TOKEN_REGISTERED_KEY, FCM_TOKEN_STORAGE_KEY } from './useFCM';

/**
 * FCM Provider component
 * Handles all FCM initialization and foreground message handling
 * - Initializes Firebase messaging when user logs in
 * - Sets up foreground message handler (increments notification count)
 * - Auto-registers token when permission is granted
 * - Cleans up on logout
 */
export function FCMProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useUserContext();
  const { refreshUnreadCount } = useNotificationContext();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Clean up if user logs out
    if (!user || !accessToken) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    // Initialize FCM and set up foreground message handler
    const initialize = async () => {
      try {
        // Initialize Firebase messaging
        const messaging = await initializeOrGetMessaging();
        if (!messaging) {
          return;
        }

        // Set up foreground message handler - just increment notification count
        const unsubscribe = onMessage(messaging, (payload: MessagePayload) => {
          console.log('[FCM] Foreground message received:', payload);
          refreshUnreadCount().catch(console.error);
        });

        unsubscribeRef.current = unsubscribe;

        // Auto-register token if permission is already granted
        if (hasNotificationPermission()) {
          const currentToken = await getFCMToken();
          if (!currentToken) {
            return;
          }

          // Check if token exists in localStorage
          const storedToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);

          // If token doesn't exist or is different, register it
          if (!storedToken || storedToken !== currentToken) {
            registerFCMToken(currentToken, accessToken, getDeviceInfo())
              .then((registered) => {
                if (registered) {
                  // Update localStorage with new token
                  localStorage.setItem(FCM_TOKEN_STORAGE_KEY, currentToken);
                  localStorage.setItem(FCM_TOKEN_REGISTERED_KEY, 'true');
                }
              })
              .catch((error) => {
                console.error('[FCM] Failed to auto-register token:', error);
              });
          }
          // If token exists and matches, do nothing
        }
      } catch (error) {
        console.error('[FCM] Initialization error:', error);
      }
    };

    initialize();

    // Cleanup on unmount or when dependencies change
    // eslint-disable-next-line consistent-return
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user, accessToken, refreshUnreadCount]);

  return <>{children}</>;
}
