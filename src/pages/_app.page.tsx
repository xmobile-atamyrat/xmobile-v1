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
  isWebView,
  registerServiceWorker,
} from '@/pages/lib/serviceWorker';
import UserContextProvider from '@/pages/lib/UserContext';
import { theme } from '@/pages/lib/utils';
import { WebSocketContextProvider } from '@/pages/lib/WebSocketContext';
import '@/styles/globals.css';
import { ThemeProvider } from '@mui/material';
import { MobilePlatforms } from '@prisma/client';
import { NextIntlClientProvider } from 'next-intl';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [mobileAppVersion, setMobileAppVersion] = useState<string | null>(null);
  const [appVersionInfo, setAppVersionInfo] = useState<{
    version: string;
    minSupportedVersion: string;
  } | null>(null);
  const [platform, setPlatform] = useState<MobilePlatforms | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const isVersionSupported = (current: string, minimum: string) => {
    const currentParts = current.split('.').map(Number);
    const minimumParts = minimum.split('.').map(Number);
    for (let i = 0; i < minimumParts.length; i += 1) {
      if ((currentParts[i] || 0) > minimumParts[i]) return true;
      if ((currentParts[i] || 0) < minimumParts[i]) return false;
    }
    return true; // Versions are equal
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
      const storedPlatform = sessionStorage.getItem(
        'mobilePlatform',
      ) as MobilePlatforms;
      if (storedPlatform) {
        setPlatform(storedPlatform);
      } else {
        // Fetch platform from backend if not in sessionStorage
        fetch('/api/platform')
          .then((res) => res.json())
          .then((data) => {
            if (data.platform) {
              const fetchedPlatform = data.platform as MobilePlatforms;
              setPlatform(fetchedPlatform);
              sessionStorage.setItem('mobilePlatform', fetchedPlatform);
            } else {
              console.warn('Platform not found in API response');
            }
          })
          .catch((error) => {
            console.error('Failed to detect mobile platform:', error);
          });
      }
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
            setMobileAppVersion(data.payload);
          }
        } catch (error) {
          console.warn('Failed to handle message from WebView:', error);
        }
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (platform) {
      fetch(`/api/app-version?platform=${platform}`)
        .then((res) => res.json())
        .then((data) => {
          setAppVersionInfo({
            version: data.version,
            minSupportedVersion: data.minSupportedVersion,
          });
        })
        .catch((error) => {
          console.warn('Failed to fetch app version info:', error);
        });
    }
  });

  useEffect(() => {
    if (mobileAppVersion && appVersionInfo) {
      const isSupported = isVersionSupported(
        mobileAppVersion,
        appVersionInfo.minSupportedVersion,
      );
      if (!isSupported) {
        setIsLoading(false);
        setShowUpdateModal(true);
      } else {
        setShowUpdateModal(false);
      }
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
                              {/* uncomment when u implement UpdateModal {showUpdateModal && <UpdateModal />} */}
                              {!isLoading && !showUpdateModal && (
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
