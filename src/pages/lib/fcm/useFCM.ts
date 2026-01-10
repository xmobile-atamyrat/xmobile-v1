import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deactivateAllTokens,
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
  const previousUserRef = useRef<typeof user>(user);
  const previousAccessTokenRef = useRef<typeof accessToken>(accessToken);

  // Check permission status and watch for changes
  useEffect(() => {
    const updatePermission = () => {
      const status = getNotificationPermission();
      const hasPerm = hasNotificationPermission();
      setPermissionStatus(status);
      setHasPermission(hasPerm);

      // If permission just changed to granted and user is logged in, get token immediately
      if (
        hasPerm &&
        status === 'granted' &&
        user &&
        accessToken &&
        !token &&
        isInitialized
      ) {
        const fetchToken = async () => {
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
        };

        fetchToken().catch(console.error);
      }
    };

    // Initial check
    updatePermission();

    // Watch for permission changes (some browsers support this)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      // Poll for permission changes (Notification API doesn't have change events)
      // Use a reasonable interval - check every 2 seconds
      const interval = setInterval(updatePermission, 2000);

      return () => clearInterval(interval);
    }

    return undefined;
  }, [user, accessToken, token, isInitialized]);

  // Handle logout - deactivate tokens when user logs out
  useEffect(() => {
    // Check if user just logged out
    if (
      previousUserRef.current &&
      previousAccessTokenRef.current &&
      (!user || !accessToken)
    ) {
      // User logged out - deactivate all tokens
      deactivateAllTokens(previousAccessTokenRef.current).catch(console.error);
    }

    // Update refs
    previousUserRef.current = user;
    previousAccessTokenRef.current = accessToken;
  }, [user, accessToken]);

  // Initialize FCM when user is logged in
  useEffect(() => {
    if (!user || !accessToken) {
      // Clean up if user logs out
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      // Clear local storage on logout
      localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
      localStorage.removeItem(FCM_TOKEN_REGISTERED_KEY);
      setToken(null);
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

        // Check current permission status
        const currentPermission = hasNotificationPermission();
        setHasPermission(currentPermission);

        if (currentPermission) {
          // Get token if we have permission
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
        } else {
          // Check if we have a stored token (from previous session)
          const storedToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
          if (storedToken) {
            setToken(storedToken);
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

  // Watch for permission changes and get token when permission is granted
  useEffect(() => {
    if (!user || !accessToken) {
      return undefined;
    }

    // If permission just changed to granted, get token immediately
    if (hasPermission && permissionStatus === 'granted' && !token) {
      const fetchToken = async () => {
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
      };

      fetchToken().catch(console.error);
    }

    return undefined;
  }, [user, accessToken, hasPermission, permissionStatus, token]);

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
      // Deactivate token
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
