/**
 * Browser / WebView analytics tracker (docs/analytics-design.md, section 1).
 *
 * - `track(name, props)` queues a typed client event in memory.
 * - The queue is sent to `POST /api/events` with `navigator.sendBeacon`
 *   (fallback: `fetch` with `keepalive`) when the page is hidden or unloaded,
 *   `CLIENT_FLUSH_INTERVAL_MS` after the first queued event, or as soon as
 *   `CLIENT_FLUSH_AT_EVENTS` are waiting. A failed send is dropped, never
 *   retried, and an empty queue sends nothing.
 * - `initAnalytics()` (called once from `_app`) records page views: one for
 *   the initial load and one per `routeChangeComplete` to a new path.
 * - `useProductView` / `useCategoryView` record one entity view per page view.
 * - A page load that repeats the previous page view (same tab, locale and
 *   path within `RELOAD_DEDUPE_MS`) records nothing: that is a technical
 *   reload (Next dev's full reload after a cold compile or an edit, tooling
 *   that navigates twice), not a new visit.
 * - A page Chrome prerenders sends nothing until the visitor actually opens
 *   it, so a discarded prerender never shows up as a page view.
 *
 * Identity lives in first-party cookies that ride along with the beacon:
 * `xa_vid` (visitor, 1 year) and `xa_sid` (session, 30 min sliding idle).
 *
 * Everything here is a no-op on the server and swallows its own errors:
 * analytics must never break a page.
 */
import {
  CLIENT_FLUSH_AT_EVENTS,
  CLIENT_FLUSH_INTERVAL_MS,
  DEFAULT_ANALYTICS_LOCALE,
  MAX_EVENTS_PER_BATCH,
  SESSION_COOKIE,
  SESSION_IDLE_S,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE_S,
} from '@/lib/analytics/constants';
import type { ClientEventName, EventProps } from '@/lib/analytics/events';
import { isWebView } from '@/pages/lib/serviceWorker';
import cookie from 'cookie';
import Router from 'next/router';
import { useEffect } from 'react';

export const EVENTS_ENDPOINT = '/api/events';

const MAX_PATH_LENGTH = 300;

/**
 * A page load that repeats the last page view of this tab within this window
 * is treated as a reload of the same view and not recorded again.
 */
export const RELOAD_DEDUPE_MS = 5_000;
/** sessionStorage key holding the last page view of this tab. */
export const LAST_PAGE_VIEW_STORAGE_KEY = 'xa_lpv';
const MAX_REFERRER_LENGTH = 200;

/**
 * Staff-only pages. Matched on whole path segments, so `/admin` and
 * `/admin/banners` are excluded but `/administrator` is not.
 */
export const EXCLUDED_PATH_PREFIXES = [
  '/admin',
  '/analytics',
  '/server-logs',
  '/procurement',
  '/orders/admin',
  '/product/bulk-edit',
  '/product/overview',
  '/product/price-list',
  '/product/update-colors',
  '/product/update-prices',
  '/user/brand-order',
  '/user/category-hierarchy',
] as const;

// Path prefixes Next adds for non-default locales (next.config.mjs i18n).
const ROUTE_LOCALES = ['en', 'ru', 'tk', 'ch', 'tr'];

export type AnalyticsPlatform = 'WEB' | 'APP';
export type AnalyticsDevice = 'mobile' | 'tablet' | 'desktop';

/** One event on the wire. */
export interface WireEvent {
  name: ClientEventName;
  props: Record<string, unknown>;
  ts: number;
}

/** Request body of `POST /api/events`. */
export interface EventsPayload {
  platform: AnalyticsPlatform;
  locale: string;
  events: WireEvent[];
}

interface QueuedEvent extends WireEvent {
  locale: string;
}

type EntityViewName = 'product_view' | 'category_view';

/** The slice of the Next router the tracker uses. */
export interface AnalyticsRouter {
  locale?: string;
  events: {
    on(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
  };
}

// ---------------------------------------------------------------------------
// Module state (one tracker per page load)
// ---------------------------------------------------------------------------

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersAttached = false;
let activeRouter: AnalyticsRouter | null = null;
let initialPageViewDone = false;
let referrerConsumed = false;
let lastPageViewKey: string | null = null;
let visitorRenewed = false;
let cachedDevice: AnalyticsDevice | null = null;
let cachedPlatform: AnalyticsPlatform | null = null;
// Whether this page load repeats the previous load's page view; computed once.
let reloadDuplicate: boolean | null = null;
// Events tracked while the page is still being prerendered.
let prerenderQueue: Array<() => void> = [];
// Bumped on every routeChangeStart, so an entity view is recorded once per
// navigation even if its effect runs twice (strict mode) within it.
let navigationToken = 0;
const lastEntityView: Partial<
  Record<EntityViewName, { id: string; token: number }>
> = {};

const isBrowser = () =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

// ---------------------------------------------------------------------------
// Identity cookies
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RFC 4122 v4 UUID; works on WebViews that predate `crypto.randomUUID`. */
export function randomUuid(): string {
  const c: Crypto | undefined =
    typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // eslint-disable-next-line no-bitwise
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // eslint-disable-next-line no-bitwise
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

function readCookie(name: string): string | undefined {
  const value = cookie.parse(document.cookie || '')[name];
  return value && UUID_RE.test(value) ? value : undefined;
}

// Not `setCookie` from `@/pages/lib/utils`: that one fires a `cookie-change`
// event (which makes useWebViewSync re-post auth/locale to the native app) and
// rewrites path-scoped copies, which is too much to do on every tracked event.
function writeCookie(name: string, value: string, maxAge: number) {
  document.cookie = cookie.serialize(name, value, {
    path: '/',
    maxAge,
    sameSite: 'lax',
    secure: window.location.protocol === 'https:',
  });
}

/**
 * Makes sure both identity cookies exist and slides the session expiry.
 * Called on every tracked event, so `xa_sid` expires 30 minutes after the
 * last one; a fresh id is minted once the browser has dropped it.
 */
function touchIdentity() {
  try {
    const visitorId = readCookie(VISITOR_COOKIE);
    if (!visitorId || !visitorRenewed) {
      writeCookie(
        VISITOR_COOKIE,
        visitorId ?? randomUuid(),
        VISITOR_COOKIE_MAX_AGE_S,
      );
      visitorRenewed = true;
    }
    writeCookie(
      SESSION_COOKIE,
      readCookie(SESSION_COOKIE) ?? randomUuid(),
      SESSION_IDLE_S,
    );
  } catch {
    // Cookies blocked: still queue the event; the server decides what to do
    // with an anonymous one.
  }
}

// ---------------------------------------------------------------------------
// Context: platform, locale, device, path, referrer
// ---------------------------------------------------------------------------

function getPlatform(): AnalyticsPlatform {
  if (cachedPlatform == null) {
    cachedPlatform = isWebView() ? 'APP' : 'WEB';
  }
  return cachedPlatform;
}

function localeFromPathname(pathname: string): string | undefined {
  const first = pathname.split('/')[1];
  return ROUTE_LOCALES.includes(first) ? first : undefined;
}

function getLocale(): string {
  let locale: string | undefined;
  try {
    locale = (activeRouter ?? Router).locale;
  } catch {
    // The Next singleton throws until the app has mounted.
  }
  return (
    locale ||
    localeFromPathname(window.location.pathname) ||
    DEFAULT_ANALYTICS_LOCALE
  );
}

/** Classifies the device from the user agent, falling back to the viewport. */
export function detectDevice(
  userAgent: string,
  maxTouchPoints = 0,
  viewportWidth = 0,
): AnalyticsDevice {
  const ua = userAgent || '';
  if (/iPad|Tablet|PlayBook|Silk|Kindle|Nexus (7|9|10)/i.test(ua)) {
    return 'tablet';
  }
  // Android tablets drop "Mobile" from the UA.
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'mobile' : 'tablet';
  if (/Mobi|iPhone|iPod|Windows Phone|IEMobile|Opera Mini|BlackBerry/i.test(ua))
    return 'mobile';
  // iPadOS 13+ reports itself as desktop Safari.
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'tablet';
  if (!ua && viewportWidth > 0) {
    if (viewportWidth < 768) return 'mobile';
    if (viewportWidth < 1024) return 'tablet';
  }
  return 'desktop';
}

function getDevice(): AnalyticsDevice {
  if (cachedDevice == null) {
    cachedDevice = detectDevice(
      navigator.userAgent,
      navigator.maxTouchPoints ?? 0,
      window.innerWidth ?? 0,
    );
  }
  return cachedDevice;
}

/**
 * Path for `page_view`: no query or hash, no locale prefix, at most 300
 * characters. Percent-encoded slugs are decoded so the dashboard is readable.
 */
export function normalizePath(url: string): string {
  let pathname = url.split(/[?#]/)[0] || '/';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(pathname)) {
    try {
      pathname = new URL(pathname).pathname;
    } catch {
      pathname = '/';
    }
  }
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  const segments = pathname.split('/');
  if (ROUTE_LOCALES.includes(segments[1])) segments.splice(1, 1);
  pathname = segments.join('/') || '/';
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.replace(/\/+$/, '') || '/';
  }
  try {
    pathname = decodeURI(pathname);
  } catch {
    // Malformed escape: keep the raw path.
  }
  return pathname.slice(0, MAX_PATH_LENGTH);
}

export function isExcludedPath(path: string): boolean {
  return EXCLUDED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** Host of `document.referrer` when it's another site, without `www.`. */
function externalReferrer(): string | undefined {
  const raw = document.referrer;
  if (!raw) return undefined;
  try {
    const { host } = new URL(raw);
    if (!host || host === window.location.host) return undefined;
    return host.replace(/^www\./i, '').slice(0, MAX_REFERRER_LENGTH);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Reloads and prerendering
// ---------------------------------------------------------------------------

function pageViewKey(path: string): string {
  return `${getLocale()}|${path}`;
}

/**
 * True when this page load shows the same locale + path as the last page
 * view recorded in this tab less than `RELOAD_DEDUPE_MS` ago. Read once per
 * page load, before this load records anything itself.
 */
function isReloadDuplicate(): boolean {
  if (reloadDuplicate == null) {
    reloadDuplicate = false;
    try {
      const raw = window.sessionStorage.getItem(LAST_PAGE_VIEW_STORAGE_KEY);
      const last = raw ? JSON.parse(raw) : null;
      const age = Date.now() - Number(last?.t);
      reloadDuplicate =
        last?.k === pageViewKey(normalizePath(window.location.pathname)) &&
        age >= 0 &&
        age < RELOAD_DEDUPE_MS;
    } catch {
      // Storage blocked or garbage: count the load.
    }
  }
  return reloadDuplicate;
}

function rememberPageView(key: string) {
  try {
    window.sessionStorage.setItem(
      LAST_PAGE_VIEW_STORAGE_KEY,
      JSON.stringify({ k: key, t: Date.now() }),
    );
  } catch {
    // Storage blocked: reloads are simply counted.
  }
}

function isPrerendering(): boolean {
  return (
    (document as Document & { prerendering?: boolean }).prerendering === true
  );
}

function onPrerenderingChange() {
  document.removeEventListener('prerenderingchange', onPrerenderingChange);
  const pending = prerenderQueue;
  prerenderQueue = [];
  pending.forEach((replay) => replay());
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

function send(body: string) {
  try {
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(EVENTS_ENDPOINT, blob)) return;
    }
  } catch {
    // Some engines reject non-form Blob types; fall through to fetch.
  }
  try {
    if (typeof fetch !== 'function') return;
    fetch(EVENTS_ENDPOINT, {
      method: 'POST',
      keepalive: true,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {
      // Dropped: analytics is best-effort.
    });
  } catch {
    // Dropped.
  }
}

/**
 * Sends everything queued, split into requests of at most
 * `MAX_EVENTS_PER_BATCH` events that share one locale.
 */
export function flush(): void {
  try {
    if (flushTimer != null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!isBrowser() || queue.length === 0) return;
    const pending = queue;
    queue = [];
    const platform = getPlatform();

    let batch: WireEvent[] = [];
    let batchLocale = pending[0].locale;
    const sendBatch = () => {
      if (batch.length === 0) return;
      const payload: EventsPayload = {
        platform,
        locale: batchLocale,
        events: batch,
      };
      send(JSON.stringify(payload));
      batch = [];
    };
    pending.forEach(({ locale, ...event }) => {
      if (locale !== batchLocale || batch.length >= MAX_EVENTS_PER_BATCH) {
        sendBatch();
        batchLocale = locale;
      }
      batch.push(event);
    });
    sendBatch();
  } catch {
    // Never throw from analytics.
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') flush();
}

function attachPageListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', flush);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Queues a client event. No-op on the server; never throws. */
export function track<N extends ClientEventName>(
  name: N,
  props: EventProps<N>,
): void {
  try {
    if (!isBrowser()) return;
    if (isPrerendering()) {
      // Not seen by anyone yet: replay once the visitor opens the page.
      if (prerenderQueue.length === 0) {
        document.addEventListener('prerenderingchange', onPrerenderingChange);
      }
      prerenderQueue.push(() => track(name, props));
      return;
    }
    attachPageListeners();
    touchIdentity();
    queue.push({
      name,
      props: { ...(props as Record<string, unknown>) },
      ts: Date.now(),
      locale: getLocale(),
    });
    if (queue.length >= CLIENT_FLUSH_AT_EVENTS) {
      flush();
    } else if (flushTimer == null) {
      flushTimer = setTimeout(flush, CLIENT_FLUSH_INTERVAL_MS);
    }
  } catch {
    // Never throw from analytics.
  }
}

/**
 * Records a `page_view` for `url` unless it's a staff page, the same
 * locale + path as the previous page view (query-only and shallow changes),
 * or the initial view of a page load that just reloads the previous view.
 */
export function trackPageView(url: string): void {
  try {
    if (!isBrowser()) return;
    const path = normalizePath(url);
    const isFirst = !referrerConsumed;
    referrerConsumed = true;
    const key = pageViewKey(path);
    if (key === lastPageViewKey) return;
    lastPageViewKey = key;
    if (isExcludedPath(path)) return;
    if (isFirst && navigationToken === 0 && isReloadDuplicate()) return;
    rememberPageView(key);

    const props: EventProps<'page_view'> = { path, device: getDevice() };
    const referrer = isFirst ? externalReferrer() : undefined;
    if (referrer) props.referrer = referrer;
    track('page_view', props);
  } catch {
    // Never throw from analytics.
  }
}

/**
 * Starts automatic page views. Call once from `_app` in an effect; it returns
 * a teardown that unsubscribes from the router. The initial page view is
 * recorded only once per page load, however often this runs.
 */
export function initAnalytics(
  router: AnalyticsRouter = Router as unknown as AnalyticsRouter,
): () => void {
  try {
    if (!isBrowser()) return () => {};
    attachPageListeners();
    activeRouter = router;

    const onStart = () => {
      navigationToken += 1;
    };
    const onComplete = (url: string) => trackPageView(url);
    router.events.on('routeChangeStart', onStart);
    router.events.on('routeChangeComplete', onComplete);

    if (!initialPageViewDone) {
      initialPageViewDone = true;
      trackPageView(window.location.pathname);
    }

    return () => {
      try {
        router.events.off('routeChangeStart', onStart);
        router.events.off('routeChangeComplete', onComplete);
        if (activeRouter === router) activeRouter = null;
      } catch {
        // Never throw from analytics.
      }
    };
  } catch {
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// Entity views
// ---------------------------------------------------------------------------

/** Records an entity view once per navigation for a given id. */
export function trackEntityView(name: EntityViewName, id: string): void {
  try {
    if (!isBrowser() || !id) return;
    // The page load repeats the previous view, so its entity view does too.
    if (navigationToken === 0 && isReloadDuplicate()) return;
    const last = lastEntityView[name];
    if (last && last.id === id && last.token === navigationToken) return;
    lastEntityView[name] = { id, token: navigationToken };
    if (name === 'product_view') {
      track('product_view', { productId: id });
    } else {
      track('category_view', { categoryId: id });
    }
  } catch {
    // Never throw from analytics.
  }
}

/** `product_view` once per page view of this product (not on re-renders). */
export function useProductView(productId: string | null | undefined): void {
  useEffect(() => {
    if (productId) trackEntityView('product_view', productId);
  }, [productId]);
}

/** `category_view` once per page view of this category. */
export function useCategoryView(categoryId: string | null | undefined): void {
  useEffect(() => {
    if (categoryId) trackEntityView('category_view', categoryId);
  }, [categoryId]);
}
