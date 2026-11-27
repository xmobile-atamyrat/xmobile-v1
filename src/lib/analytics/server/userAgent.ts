import type { AnalyticsPlatform } from '@prisma/client';

/**
 * Real browsers and WebViews all send a `Mozilla/…` (or old Opera `Opera/…`)
 * user agent. Anything else is a script or library: curl, wget, python,
 * Go-http-client, Next's own server-side `fetch` ("node"), …
 */
const BROWSER_PREFIX = /^(mozilla|opera)\//i;

/**
 * Crawlers, link-preview fetchers, headless browsers and uptime checkers that
 * do pretend to be a browser. Search crawlers hit the ISR pages a lot, and
 * every chat app fetches a preview when a product link is shared.
 */
const BOT_PATTERN = new RegExp(
  [
    'bot',
    'crawl',
    'spider',
    'slurp',
    'mediapartners',
    'facebookexternalhit',
    'embedly',
    'quora link preview',
    'pinterest',
    'vkshare',
    'whatsapp',
    'skypeuripreview',
    'preview',
    'headless',
    'phantomjs',
    'puppeteer',
    'playwright',
    'selenium',
    'webdriver',
    'lighthouse',
    'pagespeed',
    'gtmetrix',
    'pingdom',
    'uptime',
    'monitor',
    'scrapy',
    'httpclient',
    'curl',
    'wget',
    'python',
    'java/',
    'okhttp',
    'axios',
    'node-fetch',
    'undici',
    'bytespider',
    'petalsearch',
    'ia_archiver',
    'archive\\.org',
  ].join('|'),
  'i',
);

/**
 * Phone brands whose model name contains one of the words above. Stripped
 * before matching, so "CUBOT X30" isn't taken for a bot.
 */
const BOT_FALSE_POSITIVES = /cubot/gi;

/** True for crawlers, scripts and anything without a user agent. */
export function isBot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? '').trim();
  if (ua === '') return true;
  if (!BROWSER_PREFIX.test(ua)) return true;
  return BOT_PATTERN.test(ua.replace(BOT_FALSE_POSITIVES, ''));
}

/**
 * Explicit markers. The mobile app doesn't set a custom user agent today; if it
 * ever sets `applicationNameForUserAgent="XMobileApp/<version>"` on its
 * WebView, that wins here with no guessing.
 */
const APP_MARKER = /xmobileapp|reactnative/i;

/** Android System WebView: `(Linux; Android 13; SM-A135F Build/…; wv)`. */
const ANDROID_WEBVIEW = /;\s*wv\)/i;

/** iOS WKWebView: an iPhone/iPad WebKit UA without Safari's own token. */
const IOS_DEVICE = /\b(iphone|ipad|ipod)\b/i;
const IOS_WEBKIT_WITHOUT_SAFARI =
  /applewebkit\/[\d.]+ \(khtml, like gecko\)(?!.*safari)/i;

/**
 * Other apps' in-app browsers are WebViews too, but they're the web site
 * opened from a link, not our app.
 */
const OTHER_IN_APP_BROWSERS =
  /fban|fbav|fb_iab|instagram|telegram|tiktok|bytedancewebview|musical_ly|snapchat|line\/|micromessenger|viber|\bimo\b|gsa\/|twitter|linkedinapp|pinterest/i;

/**
 * 'APP' inside our React Native WebView, 'WEB' otherwise. The client knows
 * better (it can see `window.ReactNativeWebView`), so `POST /api/events`
 * prefers the platform the beacon reports; this is for `trackServer()`, which
 * only has the request. Mirrors `isWebView()` in `src/pages/lib/serviceWorker.ts`
 * as far as a user agent allows.
 */
export function detectPlatform(
  userAgent: string | null | undefined,
): AnalyticsPlatform {
  const ua = userAgent ?? '';
  if (APP_MARKER.test(ua)) return 'APP';
  if (OTHER_IN_APP_BROWSERS.test(ua)) return 'WEB';
  if (ANDROID_WEBVIEW.test(ua)) return 'APP';
  if (IOS_DEVICE.test(ua) && IOS_WEBKIT_WITHOUT_SAFARI.test(ua)) return 'APP';
  return 'WEB';
}
