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
  createAndRegisterToken: () => Promise<boolean>;
  registerToken: () => Promise<boolean>;
  unregisterToken: () => Promise<boolean>;
}

export const FCM_TOKEN_STORAGE_KEY = 'fcm_token';
export const FCM_TOKEN_REGISTERED_KEY = 'fcm_token_registered';

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

  /**
   * Check if token exists in localStorage and validate it
   * Returns true if token exists and is valid, false otherwise
   */
  const checkAndValidateToken = useCallback(async (): Promise<boolean> => {
    const storedToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    if (!storedToken) {
      return false;
    }

    try {
      // Validate that stored token matches current Firebase token
      const currentToken = await getFCMToken();
      if (currentToken === storedToken) {
        setToken(storedToken);
        return true;
      }
      // Token changed, invalidate stored token
      localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
      localStorage.removeItem(FCM_TOKEN_REGISTERED_KEY);
      return false;
    } catch (error) {
      console.error('[FCM] Failed to validate token:', error);
      return false;
    }
  }, []);

  /**
   * Create token and register with server
   * Only creates if no valid token exists and user has permission
   */
  const createAndRegisterToken = useCallback(async (): Promise<boolean> => {
    if (!user || !accessToken || !checkAndValidateToken) {
      console.warn('[FCM] Cannot register token: user not logged in');
      return false;
    }

    // Prevent concurrent registrations
    if (registrationInProgressRef.current) {
      return false;
    }

    if (!hasNotificationPermission()) {
      console.warn('[FCM] Cannot register token: permission not granted');
      return false;
    }

    // Check if token already exists and is valid
    const hasValidToken = await checkAndValidateToken();
    if (hasValidToken) {
      return true;
    }

    try {
      registrationInProgressRef.current = true;

      // Get new token from Firebase
      const newToken = await getFCMToken();
      if (!newToken) {
        console.error('[FCM] Failed to get FCM token');
        return false;
      }

      // Register with server
      const deviceInfo = getDeviceInfo();
      const registered = await registerFCMToken(
        newToken,
        accessToken,
        deviceInfo,
      );

      if (registered) {
        // Store in localStorage
        setToken(newToken);
        localStorage.setItem(FCM_TOKEN_STORAGE_KEY, newToken);
        localStorage.setItem(FCM_TOKEN_REGISTERED_KEY, 'true');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[FCM] Failed to create/register token:', error);
      return false;
    } finally {
      registrationInProgressRef.current = false;
    }
  }, [user, accessToken, checkAndValidateToken]);

  // Initialize FCM when user is logged in
  useEffect(() => {
    if (!user || !accessToken) {
      // Clean up if user logs out
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
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
          refreshUnreadCount().catch(console.error);
        });

        if (unsubscribe) {
          unsubscribeRef.current = unsubscribe;
        }

        // Check current permission status
        const currentStatus = getNotificationPermission();
        const currentHasPermission = hasNotificationPermission();
        setPermissionStatus(currentStatus);
        setHasPermission(currentHasPermission);

        // If permission granted, check/validate token or create new one
        if (currentHasPermission) {
          const hasValidToken = await checkAndValidateToken();
          if (!hasValidToken) {
            // No valid token, create and register new one
            await createAndRegisterToken();
          }
        } else {
          // No permission, but check if we have stored token for display
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
  }, [
    user,
    accessToken,
    refreshUnreadCount,
    checkAndValidateToken,
    createAndRegisterToken,
  ]);

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

    // If permission granted, create and register token
    if (permission === 'granted') {
      await createAndRegisterToken();
    }

    return permission;
  }, [createAndRegisterToken]);

  const registerToken = useCallback(async () => {
    // Alias for createAndRegisterToken for backward compatibility
    return createAndRegisterToken();
  }, [createAndRegisterToken]);

  const unregisterToken = useCallback(async () => {
    if (!user || !accessToken || !token) {
      return false;
    }

    try {
      // Unregister from server
      await unregisterFCMToken(token, accessToken).catch(console.error);
      // Clear local storage
      localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
      localStorage.removeItem(FCM_TOKEN_REGISTERED_KEY);
      setToken(null);
      return true;
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
    createAndRegisterToken,
    registerToken,
    unregisterToken,
  };
}
