import {
  AUTH_REFRESH_COOKIE_NAME,
  LOCALE_COOKIE_NAME,
} from '@/pages/lib/constants';
import {
  FCM_TOKEN_REGISTERED_USER_KEY,
  FCM_TOKEN_STORAGE_KEY,
  unregisterFCMToken,
} from '@/pages/lib/fcm/fcmClient';
import { deleteCookie } from '@/pages/lib/utils';

/**
 * Everything that has to happen on the device when a session ends — unregister
 * this device's push token, drop the auth/locale cookies and the FCM keys.
 *
 * Shared by the profile page (sign out + delete account) and the web account
 * rail (`user/components/AccountNav.tsx`) so the two can't drift apart. The
 * caller still clears `UserContext` itself, since only it holds the setters.
 */
export async function clearSessionOnDevice(accessToken?: string) {
  if (accessToken) {
    const fcmToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    if (fcmToken) {
      try {
        await unregisterFCMToken(fcmToken, accessToken);
      } catch (err) {
        // A stale token on the server is harmless; never block the sign-out.
        console.error('Failed to unregister FCM token', err);
      }
    }
  }

  deleteCookie(AUTH_REFRESH_COOKIE_NAME);
  deleteCookie(LOCALE_COOKIE_NAME);
  localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
  localStorage.removeItem(FCM_TOKEN_REGISTERED_USER_KEY);
}
