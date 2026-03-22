import { useEffect, useRef } from 'react';
import { AUTH_REFRESH_COOKIE_NAME } from '../constants';
import { ensureNativeFCMTokenRegisteredInWebView } from '../fcm/fcmClient';
import { isWebView } from '../serviceWorker';
import { ProtectedUser } from '../types';
import { getCookie } from '../utils';

export function useWebViewSync(user?: ProtectedUser, accessToken?: string) {
  const wasLoggedIn = useRef<boolean>(false);

  // Effect 1: Purely for syncing session state to the Native App
  useEffect(() => {
    if (!isWebView()) return undefined;

    const syncAuthState = () => {
      const refreshToken = getCookie(AUTH_REFRESH_COOKIE_NAME);
      const nextLocale = getCookie('NEXT_LOCALE');

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
