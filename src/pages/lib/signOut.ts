import {
  AUTH_REFRESH_COOKIE_NAME,
  LOCALE_COOKIE_NAME,
} from '@/pages/lib/constants';
import {
  clearRegistration,
  FCM_TOKEN_STORAGE_KEY,
  unregisterFCMToken,
} from '@/pages/lib/fcm/fcmClient';
import { deleteCookie } from '@/pages/lib/utils';
import { mutate } from 'swr';

/**
 * Empties the SWR cache. Sign-in and sign-out happen without a reload, so the
 * next account on this tab would otherwise be served the last one's responses
 * (the analytics dashboard's revenue).
 *
 * `revalidate: true` also drops SWR's in-flight/dedupe markers; with
 * `false`, a hook remounting with the same key inside its deduping interval
 * would neither find data nor fetch it. Only hooks still mounted on a key
 * refetch, and after sign-out none are (keys go null without a token).
 */
export async function clearClientCache(): Promise<void> {
  try {
    await mutate(() => true, undefined, { revalidate: true });
  } catch (err) {
    console.error('Failed to clear the SWR cache', err);
  }
}

/**
 * Everything that has to happen on the device when a session ends — unregister
 * this device's push token, drop the auth/locale cookies and the FCM keys,
 * and empty the client data cache.
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
  clearRegistration();
  await clearClientCache();
}
