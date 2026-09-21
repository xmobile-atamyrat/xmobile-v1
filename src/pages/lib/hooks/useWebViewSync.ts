import { useEffect, useRef } from 'react';
import { AUTH_REFRESH_COOKIE_NAME, LOCALE_COOKIE_NAME } from '../constants';
import {
  ensureNativeFCMTokenRegisteredInWebView,
  FCM_TOKEN_REGISTERED_USER_KEY,
  FCM_TOKEN_STORAGE_KEY,
  unregisterFCMToken,
} from '../fcm/fcmClient';
import { isWebView } from '../serviceWorker';
import { ProtectedUser } from '../types';
import { getCookie } from '../utils';

export function useWebViewSync(user?: ProtectedUser, accessToken?: string) {
  const wasLoggedIn = useRef<boolean>(false);
  const hasObservedLocale = useRef<boolean>(false);
  const lastSeenLocale = useRef<string | null>(null);

  // Effect 0: tell the native wrapper which language the user picked.
  //
  // The wrapper seeds NEXT_LOCALE into the WebView and runs its own screens
  // (onboarding, offline, error) off the same value, so it has to hear about a
  // change -- and AUTH_STATE below fires only for signed-in users, which left
  // every guest's choice invisible to it.
  //
  // Only a change seen while the page is open counts. Whatever is in the
  // cookie on load is the wrapper's own seed, which may be a guess read off
  // the OS language; echoing that back would store it as a deliberate choice
  // and freeze the app's language the next time the user changes their
  // phone's.
  useEffect(() => {
    if (!isWebView()) return undefined;

    const reportLocaleChoice = () => {
      const nextLocale = getCookie(LOCALE_COOKIE_NAME) ?? null;

      if (!hasObservedLocale.current) {
        hasObservedLocale.current = true;
        lastSeenLocale.current = nextLocale;
        return;
      }
      if (!nextLocale || nextLocale === lastSeenLocale.current) return;

      lastSeenLocale.current = nextLocale;
      (window as any).ReactNativeWebView?.postMessage(
        JSON.stringify({
          type: 'LOCALE_CHOICE',
          payload: { NEXT_LOCALE: nextLocale },
        }),
      );
    };

    reportLocaleChoice();
    window.addEventListener('cookie-change', reportLocaleChoice);
    return () => {
      window.removeEventListener('cookie-change', reportLocaleChoice);
    };
  }, []);

  // Effect 1: Purely for syncing session state to the Native App
  useEffect(() => {
    if (!isWebView()) return undefined;

    const syncAuthState = () => {
      const refreshToken = getCookie(AUTH_REFRESH_COOKIE_NAME);
      const nextLocale = getCookie(LOCALE_COOKIE_NAME);

      if (user && accessToken) {
        wasLoggedIn.current = true;
        (window as any).ReactNativeWebView?.postMessage(
          JSON.stringify({
            type: 'AUTH_STATE',
            payload: {
              REFRESH_TOKEN: refreshToken || null,
              NEXT_LOCALE: nextLocale || null,
            },
          }),
        );
      } else if (wasLoggedIn.current) {
        wasLoggedIn.current = false;

        const currentToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
        const storedAccessToken = getCookie(AUTH_REFRESH_COOKIE_NAME);

        if (currentToken && storedAccessToken) {
          unregisterFCMToken(currentToken, storedAccessToken).catch((err) => {
            console.error(
              '[WebViewSync] Failed to unregister FCM token on logout:',
              err,
            );
          });
        }

        localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
        localStorage.removeItem(FCM_TOKEN_REGISTERED_USER_KEY);

        (window as any).ReactNativeWebView?.postMessage(
          JSON.stringify({ type: 'LOGOUT' }),
        );
      }
    };

    syncAuthState();
    window.addEventListener('cookie-change', syncAuthState);
    return () => {
      window.removeEventListener('cookie-change', syncAuthState);
    };
  }, [user, accessToken]);

  // Effect 2: Purely for FCM Token Registration (fixes the dependency issue)
  useEffect(() => {
    if (isWebView() && user && accessToken) {
      ensureNativeFCMTokenRegisteredInWebView(user.id, accessToken).catch(
        (error) => {
          console.error(
            '[WebViewSync] Failed to ensure native FCM token registration in WebView:',
            error,
          );
        },
      );

      const handleWebViewMessage = (event: MessageEvent) => {
        try {
          const data =
            typeof event.data === 'string'
              ? JSON.parse(event.data)
              : event.data;

          if (
            data &&
            (data.type === 'FCM_TOKEN_REFRESHED' ||
              data.type === 'FCM_TOKEN_AVAILABLE')
          ) {
            console.log(
              `[WebViewSync] Detected native FCM token: ${data.type}`,
            );
            ensureNativeFCMTokenRegisteredInWebView(user.id, accessToken).catch(
              console.error,
            );
          }
        } catch (error) {
          console.error(
            '[WebViewSync] Failed to parse message event in token refresh/token available handler:',
            error,
          );
        }
      };

      window.addEventListener('message', handleWebViewMessage);
      return () => window.removeEventListener('message', handleWebViewMessage);
    }
    return undefined;
  }, [user, accessToken]);
}
