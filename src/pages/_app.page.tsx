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
import { HreflangLink, PageSeoData } from '@/pages/lib/types';
import UserContextProvider from '@/pages/lib/UserContext';
import { getCookie, setCookie, theme } from '@/pages/lib/utils';
import { WebSocketContextProvider } from '@/pages/lib/WebSocketContext';
import { LOCALE_COOKIE_NAME } from '@/pages/lib/constants';
import '@/styles/globals.css';
import { ThemeProvider } from '@mui/material';
import { NextIntlClientProvider } from 'next-intl';
import type { AppProps } from 'next/app';
import Head from 'next/head';
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
  const seoData: PageSeoData = pageProps?.seoData;

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
      (window as any).ReactNativeWebView?.postMessage(
        JSON.stringify({ type: 'REQUEST_APP_VERSION' }),
      );
      const handleMessage = (event: MessageEvent) => {
        try {
          const data =
            typeof event.data === 'string'
              ? JSON.parse(event.data)
              : event.data;
          if (data?.type === 'APP_VERSION' && data.payload) {
            setMobileAppVersion(data.payload);
          } else if (
            (data?.type === 'DEEP_LINK' ||
              data?.type === 'NOTIFICATION_CLICK') &&
            data.payload
          ) {
            const target =
              typeof data.payload === 'string'
                ? data.payload
                : data.payload.target;
            if (target) {
              router.push(target);
            }
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
    if (isWebView()) {
      setIsLoading(false);
      return undefined;
    }

    const hasShownSplash = sessionStorage.getItem('hasShownSplash');
    if (hasShownSplash) {
      setIsLoading(false);
      return undefined;
    }

    const timer = setTimeout(() => {
      setIsLoading(false);
      sessionStorage.setItem('hasShownSplash', 'true');
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Locale persistence: sync cookie with URL locale, redirect unprefixed URLs
  useEffect(() => {
    if (!router.isReady || !router.locale) return;

    const cookieLocale = getCookie(LOCALE_COOKIE_NAME);
    const pathname = window.location.pathname;
    const defaultLocale = router.defaultLocale || 'ru';

    // Detect unprefixed URL (default locale served without explicit prefix)
    const isUnprefixed =
      router.locale === defaultLocale &&
      !pathname.startsWith(`/${defaultLocale}/`) &&
      pathname !== `/${defaultLocale}`;

    if (isUnprefixed) {
      if (cookieLocale && cookieLocale !== defaultLocale) {
        router.replace(router.asPath, router.asPath, { locale: cookieLocale });
        return;
      }
      if (!cookieLocale) {
        setCookie(LOCALE_COOKIE_NAME, defaultLocale);
      }
      return;
    }

    // Prefixed URL: sync cookie to match (url > cache)
    if (cookieLocale !== router.locale) {
      setCookie(LOCALE_COOKIE_NAME, router.locale);
    }
  }, [router.isReady, router.locale, router.asPath]);

  return (
    <ThemeProvider theme={theme}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/logo/xm-logo.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#d32f2f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="XMobile" />
        <meta
          name="google-site-verification"
          content={process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_KEY}
        />
        <link rel="apple-touch-icon" href="/logo/xm-logo.png" />

        <title>{seoData?.title || 'X-mobile'}</title>

        {seoData?.noIndex === true ? (
          <meta name="robots" content="noindex, follow" />
        ) : (
          <meta name="robots" content="index, follow" />
        )}

        {seoData && (
          <>
            <meta name="description" content={seoData.description} />
            <link rel="canonical" href={seoData.canonicalUrl} />

            {seoData.hreflangLinks?.map((link: HreflangLink) => (
              <link
                key={link.locale}
                rel="alternate"
                hrefLang={link.locale}
                href={link.url}
              />
            ))}

            <meta
              property="og:title"
              content={seoData.ogTitle || seoData.title}
            />
            <meta
              property="og:description"
              content={seoData.ogDescription || seoData.description}
            />
            {seoData.ogImage && (
              <meta property="og:image" content={seoData.ogImage} />
            )}
            <meta property="og:url" content={seoData.canonicalUrl} />
            <meta property="og:type" content={seoData.ogType || 'website'} />
            <meta property="og:locale" content={seoData.ogLocale} />

            {/* Structured Data JSON-LD */}
            {seoData.productJsonLd && (
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify(seoData.productJsonLd),
                }}
              />
            )}
            {seoData.breadcrumbJsonLd && (
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify(seoData.breadcrumbJsonLd),
                }}
              />
            )}
            {seoData.organizationJsonLd && (
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify(seoData.organizationJsonLd),
                }}
              />
            )}
            {seoData.localBusinessJsonLd && (
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify(seoData.localBusinessJsonLd),
                }}
              />
            )}
          </>
        )}
      </Head>
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
                              locale={
                                router.locale || router.defaultLocale || 'ru'
                              }
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
