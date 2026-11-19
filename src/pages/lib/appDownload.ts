import { startTransition, useEffect, useState } from 'react';
import { isWebView } from './serviceWorker';

export const APP_STORE_ID = '6768824805';
// No storefront in the path, so Apple sends each visitor to their own country.
export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.xmobile.app';
// What the footer QR code encodes; app.page.tsx sends it on to a store.
export const APP_DOWNLOAD_PATH = '/app';

export type MobileOs = 'ios' | 'android';

export function detectMobileOs(
  userAgent: string,
  maxTouchPoints = 0,
): MobileOs | null {
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  // iPadOS Safari asks for desktop sites, so it reports itself as a Mac.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios';
  return null;
}

export const storeUrlFor = (os: MobileOs): string =>
  os === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;

/**
 * Safari on iOS draws its own banner from the apple-itunes-app meta tag, so
 * ours would be a second one. Other iOS browsers and in-app browsers
 * (Instagram, Chrome, Firefox) ignore the tag and lack Safari's "Version/".
 */
export function hasNativeAppBanner(userAgent: string, os: MobileOs): boolean {
  return (
    os === 'ios' &&
    /Version\/[\d.]+.*Safari/.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(userAgent)
  );
}

/**
 * The phone's OS when the site is open in a phone's browser; null on the
 * server, on desktop, and inside our own app's WebView.
 */
export function useAppDownloadOs(): MobileOs | null {
  const [os, setOs] = useState<MobileOs | null>(null);
  useEffect(() => {
    if (isWebView()) return;
    const detected = detectMobileOs(
      navigator.userAgent,
      navigator.maxTouchPoints,
    );
    // A plain update here can land while a Suspense boundary on the page is
    // still hydrating, which React answers by client-rendering it (and the dev
    // overlay reports). PlatformContext defers its update the same way.
    startTransition(() => setOs(detected));
  }, []);
  return os;
}
