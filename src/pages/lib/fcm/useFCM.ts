import { useUserContext } from '@/pages/lib/UserContext';
import { useCallback } from 'react';
import {
  getDeviceInfo,
  getFCMToken,
  getNotificationPermission,
  hasNotificationPermission,
  registerFCMToken,
} from './fcmClient';

interface UseFCMReturn {
  permissionStatus: NotificationPermission | null;
  createAndRegisterToken: () => Promise<boolean>;
}

// Export storage keys for use in other files (e.g., logout cleanup)
export const FCM_TOKEN_STORAGE_KEY = 'fcm_token';
export const FCM_TOKEN_REGISTERED_KEY = 'fcm_token_registered';

/**
 * Simplified FCM hook
 * Only exposes what UI components need:
 * - createAndRegisterToken: For permission banner to register token after user grants permission
 * - permissionStatus: For UI to check current permission state
 *
 * All initialization and foreground message handling is done in FCMProvider
 */
export function useFCM(): UseFCMReturn {
  const { user, accessToken } = useUserContext();

  /**
   * Create FCM token and register with server
   * Called by NotificationPermissionBanner when user grants permission
   */
  const createAndRegisterToken = useCallback(async (): Promise<boolean> => {
    if (!user || !accessToken) {
      console.warn('[FCM] Cannot register token: user not logged in');
      return false;
    }

    if (!hasNotificationPermission()) {
      console.warn('[FCM] Cannot register token: permission not granted');
      return false;
    }

    try {
      // Get token from Firebase
      const token = await getFCMToken();
      if (!token) {
        console.error('[FCM] Failed to get FCM token');
        return false;
      }

      // Register with server
      const deviceInfo = getDeviceInfo();
      const registered = await registerFCMToken(token, accessToken, deviceInfo);

      if (registered) {
        // Store in localStorage for reference (optional, mainly for debugging)
        localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
        localStorage.setItem(FCM_TOKEN_REGISTERED_KEY, 'true');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[FCM] Failed to create/register token:', error);
      return false;
    }
  }, [user, accessToken]);

  return {
    permissionStatus: getNotificationPermission(),
    createAndRegisterToken,
  };
}
