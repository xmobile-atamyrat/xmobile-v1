import Loader from '@/pages/components/Loader';
import AbortControllerContextProvider from '@/pages/lib/AbortControllerContext';
import CategoryContextProvider from '@/pages/lib/CategoryContext';
import { ChatContextProvider } from '@/pages/lib/ChatContext';
import DollarRateContextProvider from '@/pages/lib/DollarRateContext';
import NetworkContextProvider from '@/pages/lib/NetworkContext';
import { NotificationContextProvider } from '@/pages/lib/NotificationContext';
import PlatformContextProvider from '@/pages/lib/PlatformContext';
import PrevProductContextProvider from '@/pages/lib/PrevProductContext';
import ProductContextProvider from '@/pages/lib/ProductContext';
import {
  isServiceWorkerSupported,
  registerServiceWorker,
} from '@/pages/lib/serviceWorker';
import UserContextProvider from '@/pages/lib/UserContext';
import { theme } from '@/pages/lib/utils';
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

  // Register Service Worker for notifications (skip in WebView)
  // Register Service Worker for caching (offline-first strategy)
  // We enable this in WebView too for performance (caching only)
  useEffect(() => {
    if (typeof window !== 'undefined' && isServiceWorkerSupported()) {
      registerServiceWorker().catch((error) => {
        // Silently fail - Service Workers are optional
        console.warn('Service Worker registration failed:', error);
      });
    }
  }, []);

  useEffect(() => {
    // Immediate splash dismissal
    // We still check sessionStorage to avoid re-triggering if logic changes later,
    // but we remove the artificial 1000ms delay.
    setIsLoading(false);
    sessionStorage.setItem('hasShownSplash', 'true');
  }, []);

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
                              locale={router.locale}
                              timeZone="Asia/Ashgabat"
                              messages={pageProps.messages}
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
