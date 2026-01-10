import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDeviceInfo,
  getFCMToken,
  getNotificationPermission,
  hasNotificationPermission,
  onForegroundMessage,
  registerFCMToken,
  requestNotificationPermission,
  unregisterFCMToken,
} from './fcmClient';

interface UseFCMReturn {
  isInitialized: boolean;
  hasPermission: boolean;
  permissionStatus: NotificationPermission | null;
  token: string | null;
  requestPermission: () => Promise<NotificationPermission>;
  registerToken: () => Promise<boolean>;
  unregisterToken: () => Promise<boolean>;
}

const FCM_TOKEN_STORAGE_KEY = 'fcm_token';
const FCM_TOKEN_REGISTERED_KEY = 'fcm_token_registered';

/**
 * Hook for managing FCM in the application
 */
export function useFCM(): UseFCMReturn {
  const { user, accessToken } = useUserContext();
  const { refreshUnreadCount } = useNotificationContext();
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermission | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const registrationInProgressRef = useRef(false);

  // Check permission status
  useEffect(() => {
    const status = getNotificationPermission();
    setPermissionStatus(status);
    setHasPermission(hasNotificationPermission());
  }, []);

  // Initialize FCM when user is logged in
  useEffect(() => {
    if (!user || !accessToken) {
      // Clean up if user logs out
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setIsInitialized(false);
      return;
    }

    // Initialize FCM
    const initialize = async () => {
      try {
        // Set up foreground message handler
        const unsubscribe = onForegroundMessage((payload) => {
          console.log('[FCM] Foreground message received:', payload);

          // Refresh unread count when notification is received
          refreshUnreadCount().catch(console.error);

          // The notification will be shown by the service worker
          // But we can also handle it here if needed
        });

        if (unsubscribe) {
          unsubscribeRef.current = unsubscribe;
        }

        // Check if we have a stored token
        const storedToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
        const isRegistered = localStorage.getItem(FCM_TOKEN_REGISTERED_KEY);

        if (storedToken && isRegistered === 'true') {
          setToken(storedToken);
        } else if (hasNotificationPermission()) {
          // Get new token if we have permission
          const newToken = await getFCMToken();
          if (newToken) {
            setToken(newToken);
            localStorage.setItem(FCM_TOKEN_STORAGE_KEY, newToken);

            // Register token with server
            const deviceInfo = getDeviceInfo();
            const registered = await registerFCMToken(
              newToken,
              accessToken,
              deviceInfo,
            );

            if (registered) {
              localStorage.setItem(FCM_TOKEN_REGISTERED_KEY, 'true');
            }
          }
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('[FCM] Initialization error:', error);
        setIsInitialized(false);
      }
    };

    initialize();
  }, [user, accessToken, refreshUnreadCount]);

  // Handle token refresh
  useEffect(() => {
    if (!user || !accessToken || !hasPermission) {
      return undefined;
    }

    // Listen for token refresh (Firebase handles this automatically)
    // We'll check periodically and on focus
    const handleFocus = async () => {
      if (registrationInProgressRef.current) {
        return;
      }

      try {
        registrationInProgressRef.current = true;
        const currentToken = await getFCMToken();
        const storedToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);

        if (currentToken && currentToken !== storedToken) {
          // Token has changed, update it
          setToken(currentToken);
          localStorage.setItem(FCM_TOKEN_STORAGE_KEY, currentToken);

          // Unregister old token if exists
          if (storedToken) {
            await unregisterFCMToken(storedToken, accessToken).catch(
              console.error,
            );
          }

          // Register new token
          const deviceInfo = getDeviceInfo();
          const registered = await registerFCMToken(
            currentToken,
            accessToken,
            deviceInfo,
          );

          if (registered) {
            localStorage.setItem(FCM_TOKEN_REGISTERED_KEY, 'true');
          }
        }
      } catch (error) {
        console.error('[FCM] Token refresh error:', error);
      } finally {
        registrationInProgressRef.current = false;
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, accessToken, hasPermission, token]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  const requestPermission = useCallback(async () => {
    const permission = await requestNotificationPermission();
    setPermissionStatus(permission);
    setHasPermission(permission === 'granted');

    if (permission === 'granted' && user && accessToken) {
      // Get token and register it
      const newToken = await getFCMToken();
      if (newToken) {
        setToken(newToken);
        localStorage.setItem(FCM_TOKEN_STORAGE_KEY, newToken);

        const deviceInfo = getDeviceInfo();
        const registered = await registerFCMToken(
          newToken,
          accessToken,
          deviceInfo,
        );

        if (registered) {
          localStorage.setItem(FCM_TOKEN_REGISTERED_KEY, 'true');
        }
      }
    }

    return permission;
  }, [user, accessToken]);

  const registerToken = useCallback(async () => {
    if (!user || !accessToken || !hasPermission) {
      return false;
    }

    try {
      const currentToken = token || (await getFCMToken());
      if (!currentToken) {
        return false;
      }

      const deviceInfo = getDeviceInfo();
      const registered = await registerFCMToken(
        currentToken,
        accessToken,
        deviceInfo,
      );

      if (registered) {
        setToken(currentToken);
        localStorage.setItem(FCM_TOKEN_STORAGE_KEY, currentToken);
        localStorage.setItem(FCM_TOKEN_REGISTERED_KEY, 'true');
      }

      return registered;
    } catch (error) {
      console.error('[FCM] Token registration error:', error);
      return false;
    }
  }, [user, accessToken, hasPermission, token]);

  const unregisterToken = useCallback(async () => {
    if (!user || !accessToken || !token) {
      return false;
    }

    try {
      const unregistered = await unregisterFCMToken(token, accessToken);
      if (unregistered) {
        localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
        localStorage.removeItem(FCM_TOKEN_REGISTERED_KEY);
        setToken(null);
      }
      return unregistered;
    } catch (error) {
      console.error('[FCM] Token unregistration error:', error);
      return false;
    }
  }, [user, accessToken, token]);

  return {
    isInitialized,
    hasPermission,
    permissionStatus,
    token,
    requestPermission,
    registerToken,
    unregisterToken,
  };
}
