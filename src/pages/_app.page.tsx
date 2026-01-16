import { isNative } from '@/lib/runtime';
import Loader from '@/pages/components/Loader';
import AbortControllerContextProvider from '@/pages/lib/AbortControllerContext';
import CategoryContextProvider from '@/pages/lib/CategoryContext';
import { ChatContextProvider } from '@/pages/lib/ChatContext';
import { LOCALE_COOKIE_NAME } from '@/pages/lib/constants';
import DollarRateContextProvider from '@/pages/lib/DollarRateContext';
import NetworkContextProvider from '@/pages/lib/NetworkContext';
import { NotificationContextProvider } from '@/pages/lib/NotificationContext';
import PlatformContextProvider from '@/pages/lib/PlatformContext';
import PrevProductContextProvider from '@/pages/lib/PrevProductContext';
import ProductContextProvider from '@/pages/lib/ProductContext';
import {
  isServiceWorkerSupported,
  isWebView,
  registerServiceWorker,
} from '@/pages/lib/serviceWorker';
import UserContextProvider from '@/pages/lib/UserContext';
import { getCookie, theme } from '@/pages/lib/utils';
import { WebSocketContextProvider } from '@/pages/lib/WebSocketContext';
import '@/styles/globals.css';
import { ThemeProvider } from '@mui/material';
import { NextIntlClientProvider } from 'next-intl';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  // Get locale from cookie (for static export) or fallback to router.locale (for Next.js i18n)
  const [locale, setLocale] = useState<string>('ru');
  const [messages, setMessages] = useState(pageProps.messages || {});

  // Register Service Worker for notifications (skip in WebView and Capacitor)
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      !isWebView() &&
      !isNative() &&
      isServiceWorkerSupported()
    ) {
      registerServiceWorker().catch((error) => {
        // Silently fail - Service Workers are optional
        console.warn('Service Worker registration failed:', error);
      });
    }
  }, []);

  // Get locale from cookie or router (for backward compatibility)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cookieLocale = getCookie(LOCALE_COOKIE_NAME);
      const routerLocale = router.locale; // Fallback for pages still using Next.js i18n
      const currentLocale = cookieLocale || routerLocale || 'ru';

      setLocale(currentLocale);

      // If pageProps has allMessages (from pages using new approach), use it
      // Otherwise use pageProps.messages (from pages still using Next.js i18n)
      if (pageProps.allMessages) {
        const allMessages = pageProps.allMessages;
        setMessages(allMessages[currentLocale] || allMessages.ru || {});
      } else {
        // For pages still using Next.js i18n, use the messages as-is
        setMessages(pageProps.messages || {});
      }
    }
  }, [router.locale, pageProps]);

  useEffect(() => {
    const hasShownSplash = sessionStorage.getItem('hasShownSplash');
    if (hasShownSplash) {
      setIsLoading(false);
    }

    const timer = setTimeout(() => {
      setIsLoading(false);
      sessionStorage.setItem('hasShownSplash', 'true');
    }, 1000);

    return () => clearTimeout(timer);
  });

  return (
    <ThemeProvider theme={theme}>
      <NetworkContextProvider>
        <AbortControllerContextProvider>
          <UserContextProvider>
            <WebSocketContextProvider>
              <NotificationContextProvider>
                <ChatContextProvider>
                  <CategoryContextProvider>
                    <ProductContextProvider>
                      <PrevProductContextProvider>
                        <DollarRateContextProvider>
                          <PlatformContextProvider>
                            <NextIntlClientProvider
                              locale={locale}
                              timeZone="Asia/Ashgabat"
                              messages={messages}
                            >
                              {isLoading ? (
                                <Loader />
                              ) : (
                                <Component {...pageProps} />
                              )}
                            </NextIntlClientProvider>
                          </PlatformContextProvider>
                        </DollarRateContextProvider>
                      </PrevProductContextProvider>
                    </ProductContextProvider>
                  </CategoryContextProvider>
                </ChatContextProvider>
              </NotificationContextProvider>
            </WebSocketContextProvider>
          </UserContextProvider>
        </AbortControllerContextProvider>
      </NetworkContextProvider>
    </ThemeProvider>
  );
}
