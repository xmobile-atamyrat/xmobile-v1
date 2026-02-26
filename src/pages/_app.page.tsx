import Loader from '@/pages/components/Loader';
import UpdateModal from '@/pages/components/UpdateModal';
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
  isWebView,
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
  const [mobileAppVersion, setMobileAppVersion] = useState<string | null>(null);
  const [appVersionInfo, setAppVersionInfo] = useState<{
    hardMinVersion: string;
    softMinVersion: string;
  } | null>(null);
  const [showHardUpdateModal, setShowHardUpdateModal] = useState(false);

  const isVersionSupported = (current: string, minimum: string) => {
    const currentParts = current.split('.').map(Number);
    const minimumParts = minimum.split('.').map(Number);
    for (let i = 0; i < minimumParts.length; i += 1) {
      if ((currentParts[i] || 0) > minimumParts[i]) return true;
      if ((currentParts[i] || 0) < minimumParts[i]) return false;
    }
    return true;
  };
  // Register Service Worker for notifications (skip in WebView)
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      !isWebView() &&
      isServiceWorkerSupported()
    ) {
      registerServiceWorker().catch((error) => {
        // Silently fail - Service Workers are optional
        console.warn('Service Worker registration failed:', error);
      });
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && isWebView()) {
      const handleMessage = (event: MessageEvent) => {
        try {
          const data =
            typeof event.data === 'string'
              ? JSON.parse(event.data)
              : event.data;
          if (data?.type === 'APP_VERSION' && data.payload) {
            console.log('App version received from bridge:', data.payload);
            setMobileAppVersion(data.payload);
          }
        } catch (error) {
          console.error('Failed to handle message from WebView:', error);
        }
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && isWebView()) {
      fetch('/api/app-version')
        .then((res) => res.json())
        .then((data) => {
          setAppVersionInfo({
            hardMinVersion: data.hardMinVersion,
            softMinVersion: data.softMinVersion,
          });
        })
        .catch((error) => {
          console.error('Failed to fetch app version info:', error);
        });
    }
  }, []);

  useEffect(() => {
    if (mobileAppVersion && appVersionInfo) {
      const isHardSupported = isVersionSupported(
        mobileAppVersion,
        appVersionInfo.hardMinVersion,
      );
      setShowHardUpdateModal(!isHardSupported);
      if (!isHardSupported) setIsLoading(false);
    }
  }, [mobileAppVersion, appVersionInfo]);

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
                              {isLoading && <Loader />}
                              {showHardUpdateModal && (
                                <UpdateModal type="hard" />
                              )}
                              {!isLoading && !showHardUpdateModal && (
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
