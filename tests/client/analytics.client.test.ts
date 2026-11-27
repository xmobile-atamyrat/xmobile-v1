// @vitest-environment jsdom

import {
  CLIENT_FLUSH_AT_EVENTS,
  CLIENT_FLUSH_INTERVAL_MS,
  MAX_EVENTS_PER_BATCH,
  SESSION_COOKIE,
  SESSION_IDLE_S,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE_S,
} from '@/lib/analytics/constants';
import { render } from '@testing-library/react';
import { createElement, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ClientModule = typeof import('@/lib/analytics/client');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORIGINAL_UA = navigator.userAgent;
const cookieDescriptor = Object.getOwnPropertyDescriptor(
  Document.prototype,
  'cookie',
)!;

/** A minimal Next-router stand-in whose events we fire by hand. */
function createFakeRouter(locale = 'ru') {
  const handlers = new Map<string, Set<(...args: any[]) => void>>();
  return {
    locale,
    events: {
      on(event: string, handler: (...args: any[]) => void) {
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event)!.add(handler);
      },
      off(event: string, handler: (...args: any[]) => void) {
        handlers.get(event)?.delete(handler);
      },
    },
    emit(event: string, ...args: any[]) {
      handlers.get(event)?.forEach((handler) => handler(...args));
    },
    listenerCount(event: string) {
      return handlers.get(event)?.size ?? 0;
    },
    /** routeChangeStart then routeChangeComplete, like a client navigation. */
    navigate(url: string, options: { shallow?: boolean } = {}) {
      this.emit('routeChangeStart', url, { shallow: !!options.shallow });
      this.emit('routeChangeComplete', url, { shallow: !!options.shallow });
    },
  };
}

function clearCookies() {
  cookieDescriptor.set!.call(document, `${VISITOR_COOKIE}=; Max-Age=0; Path=/`);
  cookieDescriptor.set!.call(document, `${SESSION_COOKIE}=; Max-Age=0; Path=/`);
}

function readCookies(): Record<string, string> {
  return Object.fromEntries(
    document.cookie
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const i = part.indexOf('=');
        return [part.slice(0, i), decodeURIComponent(part.slice(i + 1))];
      }),
  );
}

/** Records every cookie string written while still storing it in jsdom. */
function spyCookieWrites(): string[] {
  const writes: string[] = [];
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => cookieDescriptor.get!.call(document),
    set: (value: string) => {
      writes.push(value);
      cookieDescriptor.set!.call(document, value);
    },
  });
  return writes;
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
}

function setPrerendering(value: boolean | undefined) {
  Object.defineProperty(document, 'prerendering', {
    configurable: true,
    get: () => value,
  });
}

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    get: () => ua,
  });
}

function setReferrer(referrer: string) {
  Object.defineProperty(document, 'referrer', {
    configurable: true,
    get: () => referrer,
  });
}

async function blobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

let beacon: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;
let analytics: ClientModule;

/** A fresh copy of the tracker, as a new page load in the same tab gets. */
async function reloadPage(): Promise<ClientModule> {
  analytics.flush();
  vi.resetModules();
  analytics = await import('@/lib/analytics/client');
  return analytics;
}

/** Payloads sent so far, whichever transport carried them. */
async function sentPayloads() {
  const fromBeacon = await Promise.all(
    beacon.mock.calls.map(async ([, blob]) => JSON.parse(await blobText(blob))),
  );
  const fromFetch = fetchMock.mock.calls.map(([, init]) =>
    JSON.parse(init.body),
  );
  return [...fromBeacon, ...fromFetch];
}

async function sentEvents() {
  return (await sentPayloads()).flatMap((payload) => payload.events);
}

beforeEach(async () => {
  vi.resetModules();
  clearCookies();
  setVisibility('visible');
  setUserAgent(ORIGINAL_UA);
  setReferrer('');
  setPrerendering(undefined);
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  beacon = vi.fn().mockReturnValue(true);
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  Object.defineProperty(window.navigator, 'sendBeacon', {
    configurable: true,
    writable: true,
    value: beacon,
  });
  vi.stubGlobal('fetch', fetchMock);
  analytics = await import('@/lib/analytics/client');
});

afterEach(() => {
  // Each test imports a fresh module, but the old one's page listeners stay
  // attached, so drain its queue here rather than into the next test's mocks.
  analytics.flush();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  // Drop the spy so the next test sees jsdom's own cookie jar accessor.
  delete (document as any).cookie;
  delete (window as any).ReactNativeWebView;
});

describe('identity cookies', () => {
  it('creates xa_vid and xa_sid as random UUIDs on the first event', () => {
    const writes = spyCookieWrites();

    analytics.track('product_view', { productId: 'p1' });

    const cookies = readCookies();
    expect(cookies[VISITOR_COOKIE]).toMatch(UUID_RE);
    expect(cookies[SESSION_COOKIE]).toMatch(UUID_RE);
    expect(cookies[VISITOR_COOKIE]).not.toBe(cookies[SESSION_COOKIE]);

    const vid = writes.find((w) => w.startsWith(`${VISITOR_COOKIE}=`))!;
    expect(vid).toContain(`Max-Age=${VISITOR_COOKIE_MAX_AGE_S}`);
    expect(vid).toContain('Path=/');
    expect(vid).toContain('SameSite=Lax');
    expect(vid).not.toContain('Secure');
    const sid = writes.find((w) => w.startsWith(`${SESSION_COOKIE}=`))!;
    expect(sid).toContain(`Max-Age=${SESSION_IDLE_S}`);
    expect(sid).toContain('Path=/');
    expect(sid).toContain('SameSite=Lax');
  });

  it('reuses existing cookies instead of minting new ids', () => {
    const vid = '0b6b3a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
    const sid = '1c7c4b5f-2d3e-4f60-9bac-1d2e3f4a5b6c';
    document.cookie = `${VISITOR_COOKIE}=${vid}; Path=/`;
    document.cookie = `${SESSION_COOKIE}=${sid}; Path=/`;

    analytics.track('product_view', { productId: 'p1' });
    analytics.track('product_view', { productId: 'p2' });

    expect(readCookies()[VISITOR_COOKIE]).toBe(vid);
    expect(readCookies()[SESSION_COOKIE]).toBe(sid);
  });

  it('slides the session expiry on every tracked event', () => {
    const writes = spyCookieWrites();

    analytics.track('product_view', { productId: 'p1' });
    analytics.track('product_view', { productId: 'p2' });
    analytics.track('product_view', { productId: 'p3' });

    const sessionWrites = writes.filter((w) =>
      w.startsWith(`${SESSION_COOKIE}=`),
    );
    expect(sessionWrites).toHaveLength(3);
    sessionWrites.forEach((w) =>
      expect(w).toContain(`Max-Age=${SESSION_IDLE_S}`),
    );
    // Same session id each time.
    expect(new Set(sessionWrites.map((w) => w.split(';')[0])).size).toBe(1);
    // The visitor cookie is refreshed once per page load, not per event.
    expect(
      writes.filter((w) => w.startsWith(`${VISITOR_COOKIE}=`)),
    ).toHaveLength(1);
  });

  it('starts a new session once the idle cookie has expired', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T10:00:00Z'));
    analytics.track('product_view', { productId: 'p1' });
    const first = readCookies();

    // 29 minutes later: still the same session, and its expiry slides.
    vi.setSystemTime(new Date('2026-11-27T10:29:00Z'));
    analytics.track('product_view', { productId: 'p2' });
    expect(readCookies()[SESSION_COOKIE]).toBe(first[SESSION_COOKIE]);

    // 31 minutes after the last event the browser has dropped xa_sid.
    vi.setSystemTime(new Date('2026-11-27T11:00:00Z'));
    expect(readCookies()[SESSION_COOKIE]).toBeUndefined();
    analytics.track('product_view', { productId: 'p3' });
    const after = readCookies();
    expect(after[SESSION_COOKIE]).toMatch(UUID_RE);
    expect(after[SESSION_COOKIE]).not.toBe(first[SESSION_COOKIE]);
    expect(after[VISITOR_COOKIE]).toBe(first[VISITOR_COOKIE]);
  });

  it('replaces a malformed (non-UUID) cookie value', () => {
    document.cookie = `${VISITOR_COOKIE}=not-a-uuid; Path=/`;

    analytics.track('product_view', { productId: 'p1' });

    expect(readCookies()[VISITOR_COOKIE]).toMatch(UUID_RE);
  });

  it('marks the cookies Secure on https', async () => {
    const { jsdom } = globalThis as any;
    jsdom.reconfigure({ url: 'https://xmobile.test/' });
    try {
      const writes = spyCookieWrites();
      analytics.track('product_view', { productId: 'p1' });
      const ours = writes.filter(
        (w) =>
          w.startsWith(`${VISITOR_COOKIE}=`) ||
          w.startsWith(`${SESSION_COOKIE}=`),
      );
      expect(ours.length).toBeGreaterThanOrEqual(2);
      ours.forEach((w) => expect(w).toContain('Secure'));
    } finally {
      clearCookies();
      jsdom.reconfigure({ url: 'http://localhost:3000/' });
    }
  });
});

describe('randomUuid', () => {
  it('uses crypto.randomUUID when available', () => {
    const spy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(analytics.randomUuid()).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    spy.mockRestore();
  });

  it('falls back to getRandomValues on WebViews without randomUUID', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(0xff),
    });
    const id = analytics.randomUuid();
    expect(id).toMatch(UUID_RE);
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('falls back to Math.random without any crypto', () => {
    vi.stubGlobal('crypto', undefined);
    const ids = new Set(
      Array.from({ length: 20 }, () => analytics.randomUuid()),
    );
    ids.forEach((id) => expect(id).toMatch(UUID_RE));
    expect(ids.size).toBe(20);
  });
});

describe('batching and flushing', () => {
  it('sends nothing when the queue is empty', () => {
    analytics.flush();
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));

    expect(beacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('holds events until a flush trigger fires', () => {
    analytics.track('product_view', { productId: 'p1' });
    analytics.track('category_view', { categoryId: 'c1' });

    expect(beacon).not.toHaveBeenCalled();
  });

  it('flushes when the page becomes hidden', async () => {
    analytics.track('product_view', { productId: 'p1' });

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(beacon).not.toHaveBeenCalled();

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(await sentEvents()).toHaveLength(1);
  });

  it('flushes on pagehide', () => {
    analytics.track('product_view', { productId: 'p1' });

    window.dispatchEvent(new Event('pagehide'));

    expect(beacon).toHaveBeenCalledTimes(1);
  });

  it(`flushes ${CLIENT_FLUSH_INTERVAL_MS}ms after the first queued event`, async () => {
    vi.useFakeTimers();
    analytics.track('product_view', { productId: 'p1' });
    vi.advanceTimersByTime(CLIENT_FLUSH_INTERVAL_MS / 2);
    analytics.track('product_view', { productId: 'p2' });

    vi.advanceTimersByTime(CLIENT_FLUSH_INTERVAL_MS / 2 - 1);
    expect(beacon).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(await sentEvents()).toHaveLength(2);

    // No timer is left running once the queue is empty.
    vi.advanceTimersByTime(CLIENT_FLUSH_INTERVAL_MS * 3);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it(`flushes as soon as ${CLIENT_FLUSH_AT_EVENTS} events are queued`, async () => {
    for (let i = 0; i < CLIENT_FLUSH_AT_EVENTS - 1; i += 1) {
      analytics.track('product_view', { productId: `p${i}` });
    }
    expect(beacon).not.toHaveBeenCalled();

    analytics.track('product_view', { productId: 'last' });

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(await sentEvents()).toHaveLength(CLIENT_FLUSH_AT_EVENTS);
  });

  it(`splits a flush into requests of at most ${MAX_EVENTS_PER_BATCH} events`, async () => {
    // The size trigger normally flushes long before a batch fills up, so
    // disable it to queue more than MAX_EVENTS_PER_BATCH events.
    const total = MAX_EVENTS_PER_BATCH * 2 + 5;
    vi.resetModules();
    vi.doMock('@/lib/analytics/constants', async (importOriginal) => ({
      ...(await importOriginal<object>()),
      CLIENT_FLUSH_AT_EVENTS: Number.MAX_SAFE_INTEGER,
    }));
    const fresh: ClientModule = await import('@/lib/analytics/client');
    for (let i = 0; i < total; i += 1) {
      fresh.track('product_view', { productId: `p${i}` });
    }
    fresh.flush();
    vi.doUnmock('@/lib/analytics/constants');

    const payloads = await sentPayloads();
    expect(payloads.map((p) => p.events.length)).toEqual([
      MAX_EVENTS_PER_BATCH,
      MAX_EVENTS_PER_BATCH,
      5,
    ]);
    // Order is preserved across the split.
    expect(
      payloads.flatMap((p) => p.events.map((e: any) => e.props.productId)),
    ).toEqual(Array.from({ length: total }, (_, i) => `p${i}`));
  });

  it('drops a batch that fails instead of retrying it', async () => {
    beacon.mockReturnValue(false);
    fetchMock.mockRejectedValue(new Error('offline'));
    analytics.track('product_view', { productId: 'p1' });
    analytics.flush();
    await Promise.resolve();

    analytics.track('product_view', { productId: 'p2' });
    analytics.flush();

    const bodies = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(init.body),
    );
    expect(
      bodies.map((b) => b.events.map((e: any) => e.props.productId)),
    ).toEqual([['p1'], ['p2']]);
  });
});

describe('transport', () => {
  it('uses sendBeacon with a JSON blob to /api/events', async () => {
    analytics.track('product_view', { productId: 'p1' });
    analytics.flush();

    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0];
    expect(url).toBe('/api/events');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/json');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to fetch keepalive when sendBeacon is missing', () => {
    Object.defineProperty(window.navigator, 'sendBeacon', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    analytics.track('product_view', { productId: 'p1' });
    analytics.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/events');
    expect(init).toMatchObject({
      method: 'POST',
      keepalive: true,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(init.body).events).toHaveLength(1);
  });

  it('falls back to fetch when sendBeacon refuses the payload', () => {
    beacon.mockReturnValue(false);
    analytics.track('product_view', { productId: 'p1' });
    analytics.flush();

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to fetch when sendBeacon throws', () => {
    beacon.mockImplementation(() => {
      throw new TypeError('blob type not allowed');
    });
    analytics.track('product_view', { productId: 'p1' });

    expect(() => analytics.flush()).not.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('payload', () => {
  it('has platform, locale and events with name, props and track-time ts', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000);
    analytics.track('product_view', { productId: 'p1' });
    vi.setSystemTime(2_000);
    analytics.track('category_view', { categoryId: 'c1' });
    vi.setSystemTime(9_000);
    analytics.flush();

    const [payload] = await sentPayloads();
    expect(payload).toEqual({
      platform: 'WEB',
      locale: 'ru',
      // Send time on the same clock as ts, so the server can correct skew.
      sentAt: 9_000,
      events: [
        { name: 'product_view', props: { productId: 'p1' }, ts: 1_000 },
        { name: 'category_view', props: { categoryId: 'c1' }, ts: 2_000 },
      ],
    });
  });

  it('tags events from the mobile WebView as APP', async () => {
    (window as any).ReactNativeWebView = { postMessage: vi.fn() };
    analytics.track('product_view', { productId: 'p1' });
    analytics.flush();

    expect((await sentPayloads())[0].platform).toBe('APP');
  });

  it.each([
    [
      'an Android WebView of another app (Instagram)',
      'Mozilla/5.0 (Linux; Android 13; SM-A515F Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 Instagram 300.0.0.0',
    ],
    [
      'a generic Android WebView UA',
      'Mozilla/5.0 (Linux; Android 13; SM-A515F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36',
    ],
  ])('tags %s without ReactNativeWebView as WEB', async (_label, ua) => {
    setUserAgent(ua);
    // iOS in-app browsers expose WKWebView message handlers too.
    (window as any).webkit = { messageHandlers: {} };
    try {
      analytics.track('product_view', { productId: 'p1' });
      analytics.flush();
      expect((await sentPayloads())[0].platform).toBe('WEB');
    } finally {
      delete (window as any).webkit;
    }
  });

  it('uses the router locale', async () => {
    analytics.initAnalytics(createFakeRouter('tk'));
    analytics.flush();

    expect((await sentPayloads())[0].locale).toBe('tk');
  });

  it('reads the locale from the URL prefix before the router is up', async () => {
    window.history.replaceState({}, '', '/en/product/x');
    analytics.track('product_view', { productId: 'p1' });
    analytics.flush();

    expect((await sentPayloads())[0].locale).toBe('en');
  });

  it('splits batches when the locale changes mid-queue', async () => {
    const router = createFakeRouter('ru');
    analytics.initAnalytics(router);
    router.locale = 'tk';
    router.navigate('/tk/product/x');
    analytics.flush();

    const payloads = await sentPayloads();
    expect(payloads.map((p) => [p.locale, p.events.length])).toEqual([
      ['ru', 1],
      ['tk', 1],
    ]);
  });
});

describe('detectDevice', () => {
  it.each([
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      0,
      'mobile',
    ],
    [
      'Mozilla/5.0 (Linux; Android 13; SM-A515F; wv) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
      0,
      'mobile',
    ],
    [
      'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
      0,
      'tablet',
    ],
    [
      'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      0,
      'tablet',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
      5,
      'tablet',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
      0,
      'desktop',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
      0,
      'desktop',
    ],
  ])('%s → %s', (ua, touchPoints, expected) => {
    expect(analytics.detectDevice(ua, touchPoints as number)).toBe(expected);
  });

  it('uses the viewport when there is no user agent', () => {
    expect(analytics.detectDevice('', 0, 390)).toBe('mobile');
    expect(analytics.detectDevice('', 0, 800)).toBe('tablet');
    expect(analytics.detectDevice('', 0, 1440)).toBe('desktop');
  });
});

describe('normalizePath / isExcludedPath', () => {
  it.each([
    ['/', '/'],
    ['/product/phone?color=red#top', '/product/phone'],
    ['/en/product/phone', '/product/phone'],
    ['/tk', '/'],
    ['/ru/', '/'],
    ['/category/x/', '/category/x'],
    ['/english-books', '/english-books'],
    ['http://localhost:3003/tr/cart?x=1', '/cart'],
    ['/product/%D1%82%D0%B5%D0%BB', '/product/тел'],
    ['/product/%E0%A4%A', '/product/%E0%A4%A'],
  ])('%s → %s', (input, expected) => {
    expect(analytics.normalizePath(input)).toBe(expected);
  });

  it('caps the path without splitting a surrogate pair', () => {
    // '/' + 298 'a' + an emoji = 301 units; a plain slice would keep half of it.
    const path = analytics.normalizePath(`/${'a'.repeat(298)}😀x`);
    expect(path).toBe(`/${'a'.repeat(298)}`);
    expect(analytics.truncateText('a😀', 2)).toBe('a');
    expect(analytics.truncateText('a😀', 3)).toBe('a😀');
  });

  it('caps the path at 300 characters', () => {
    expect(analytics.normalizePath(`/${'a'.repeat(500)}`)).toHaveLength(300);
  });

  it.each([
    '/admin',
    '/admin/banners',
    '/analytics',
    '/server-logs',
    '/procurement',
    '/orders/admin/123',
    '/product/update-prices',
    '/product/bulk-edit',
    '/product/price-list',
    '/product/update-colors',
    '/product/overview',
    '/user/category-hierarchy',
    '/user/brand-order',
  ])('excludes staff route %s', (path) => {
    expect(analytics.isExcludedPath(path)).toBe(true);
  });

  it.each(['/', '/administrator', '/product/admin-phone', '/orders', '/user'])(
    'keeps shopper route %s',
    (path) => {
      expect(analytics.isExcludedPath(path)).toBe(false);
    },
  );
});

describe('automatic page views', () => {
  it('records one page_view for the initial load', async () => {
    window.history.replaceState({}, '', '/en/category/phones?sort=price');
    analytics.initAnalytics(createFakeRouter('en'));
    analytics.flush();

    expect(await sentEvents()).toEqual([
      {
        name: 'page_view',
        props: { path: '/category/phones', device: 'desktop' },
        ts: expect.any(Number),
      },
    ]);
  });

  it('records the initial page view once even if init runs twice', async () => {
    const router = createFakeRouter();
    const teardown = analytics.initAnalytics(router);
    teardown();
    analytics.initAnalytics(router);
    analytics.flush();

    expect(await sentEvents()).toHaveLength(1);
    // The teardown removed the first set of router listeners.
    expect(router.listenerCount('routeChangeComplete')).toBe(1);
  });

  // Regression: a fresh load of `/ru/` right after `next dev` started logged
  // two page views ~1 s apart. Next dev reloaded the page once its first
  // compile finished, so a second page load (new module state) recorded the
  // same view again.
  it('does not count a reload of the same page right after it as a new view', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T10:00:00Z'));
    window.history.replaceState({}, '', '/ru/');
    analytics.initAnalytics(createFakeRouter('ru'));
    analytics.trackEntityView('product_view', 'p1');

    vi.setSystemTime(new Date('2026-11-27T10:00:01Z'));
    await reloadPage();
    analytics.trackEntityView('product_view', 'p1'); // page effect runs first
    const router = createFakeRouter('ru');
    analytics.initAnalytics(router);
    // Later navigations in the reloaded page still count.
    router.navigate('/cart');
    analytics.trackEntityView('product_view', 'p1');
    analytics.flush();

    expect((await sentEvents()).map((e) => [e.name, e.props])).toEqual([
      ['page_view', { path: '/', device: 'desktop' }],
      ['product_view', { productId: 'p1' }],
      ['page_view', { path: '/cart', device: 'desktop' }],
      ['product_view', { productId: 'p1' }],
    ]);
  });

  it('counts a reload after the dedupe window, or of another path or locale', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T10:00:00Z'));
    analytics.initAnalytics(createFakeRouter('ru'));

    vi.setSystemTime(
      new Date(Date.parse('2026-11-27T10:00:00Z') + analytics.RELOAD_DEDUPE_MS),
    );
    await reloadPage();
    analytics.initAnalytics(createFakeRouter('ru'));

    await reloadPage();
    window.history.replaceState({}, '', '/tk');
    analytics.initAnalytics(createFakeRouter('tk'));

    await reloadPage();
    window.history.replaceState({}, '', '/tk/cart');
    analytics.initAnalytics(createFakeRouter('tk'));
    analytics.flush();

    const payloads = await sentPayloads();
    expect(payloads.map((p) => [p.locale, p.events[0].props.path])).toEqual([
      ['ru', '/'],
      ['ru', '/'],
      ['tk', '/'],
      ['tk', '/cart'],
    ]);
  });

  it('counts every load when sessionStorage is unavailable', async () => {
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    try {
      analytics.initAnalytics(createFakeRouter());
      await reloadPage();
      analytics.initAnalytics(createFakeRouter());
      analytics.flush();

      expect(await sentEvents()).toHaveLength(2);
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });

  it('holds events from a prerendered page until it is opened', async () => {
    setPrerendering(true);
    analytics.initAnalytics(createFakeRouter());
    analytics.trackEntityView('product_view', 'p1');
    analytics.flush();
    expect(beacon).not.toHaveBeenCalled();
    expect(readCookies()[VISITOR_COOKIE]).toBeUndefined();

    setPrerendering(false);
    document.dispatchEvent(new Event('prerenderingchange'));
    analytics.flush();

    expect((await sentEvents()).map((e) => e.name)).toEqual([
      'page_view',
      'product_view',
    ]);
  });

  it('records one page_view per route change', async () => {
    const router = createFakeRouter();
    analytics.initAnalytics(router);
    router.navigate('/category/phones');
    router.navigate('/product/iphone');
    analytics.flush();

    expect((await sentEvents()).map((e) => e.props.path)).toEqual([
      '/',
      '/category/phones',
      '/product/iphone',
    ]);
  });

  it('ignores query-only and shallow changes on the same path', async () => {
    const router = createFakeRouter();
    analytics.initAnalytics(router);
    router.navigate('/product-category/phones');
    router.navigate('/product-category/phones?sort=price', { shallow: true });
    router.navigate('/product-category/phones?brand=apple');
    router.navigate('/product-category/phones#reviews');
    analytics.flush();

    expect((await sentEvents()).map((e) => e.props.path)).toEqual([
      '/',
      '/product-category/phones',
    ]);
  });

  it('counts a revisit after navigating elsewhere', async () => {
    const router = createFakeRouter();
    analytics.initAnalytics(router);
    router.navigate('/product/a');
    router.navigate('/');
    router.navigate('/product/a');
    analytics.flush();

    expect((await sentEvents()).map((e) => e.props.path)).toEqual([
      '/',
      '/product/a',
      '/',
      '/product/a',
    ]);
  });

  it('records a new page view when only the locale changes', async () => {
    const router = createFakeRouter('ru');
    analytics.initAnalytics(router);
    router.locale = 'tk';
    router.navigate('/tk');
    analytics.flush();

    const payloads = await sentPayloads();
    expect(payloads.map((p) => [p.locale, p.events[0].props.path])).toEqual([
      ['ru', '/'],
      ['tk', '/'],
    ]);
  });

  it('skips staff routes', async () => {
    window.history.replaceState({}, '', '/admin/banners');
    const router = createFakeRouter();
    analytics.initAnalytics(router);
    router.navigate('/analytics');
    router.navigate('/en/server-logs');
    router.navigate('/procurement');
    router.navigate('/orders/admin/1');
    router.navigate('/cart');
    analytics.flush();

    expect((await sentEvents()).map((e) => e.props.path)).toEqual(['/cart']);
  });

  it('sends nothing at all for a staff-only session', () => {
    window.history.replaceState({}, '', '/admin');
    const router = createFakeRouter();
    analytics.initAnalytics(router);
    router.navigate('/analytics');
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(beacon).not.toHaveBeenCalled();
    expect(readCookies()[VISITOR_COOKIE]).toBeUndefined();
  });

  it('adds the device from the user agent', async () => {
    setUserAgent(
      'Mozilla/5.0 (Linux; Android 13; SM-A515F) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
    );
    analytics.initAnalytics(createFakeRouter());
    analytics.flush();

    expect((await sentEvents())[0].props.device).toBe('mobile');
  });

  it('adds an external referrer host to the first page view only', async () => {
    setReferrer('https://www.google.com/search?q=xmobile');
    const router = createFakeRouter();
    analytics.initAnalytics(router);
    router.navigate('/product/a');
    analytics.flush();

    const events = await sentEvents();
    expect(events[0].props.referrer).toBe('google.com');
    expect(events[1].props).not.toHaveProperty('referrer');
  });

  it('sends the referrer host name, lowercased, without a port', async () => {
    setReferrer('https://WWW.Example.COM:8443/path?q=1');
    analytics.initAnalytics(createFakeRouter());
    analytics.flush();

    expect((await sentEvents())[0].props.referrer).toBe('example.com');
  });

  it.each([
    ['an IPv6 host', 'http://[::1]:8080/'],
    ['a too-long host', `https://${'a'.repeat(100)}.com/`],
  ])('omits a referrer that is %s', async (_label, referrer) => {
    setReferrer(referrer);
    analytics.initAnalytics(createFakeRouter());
    analytics.flush();

    expect((await sentEvents())[0].props).not.toHaveProperty('referrer');
  });

  it('omits the referrer for internal navigation and direct visits', async () => {
    setReferrer(`${window.location.origin}/category/x`);
    analytics.initAnalytics(createFakeRouter());
    analytics.flush();

    expect((await sentEvents())[0].props).not.toHaveProperty('referrer');
  });

  it('works with the real next/router export (next-router-mock in tests)', async () => {
    const { default: mockRouter } = await import('next-router-mock');
    analytics.initAnalytics();
    await mockRouter.push('/product/from-mock?x=1');
    analytics.flush();

    expect((await sentEvents()).map((e) => e.props.path)).toEqual([
      '/',
      '/product/from-mock',
    ]);
  });
});

describe('back/forward cache', () => {
  function pageShow(persisted: boolean) {
    const event = new Event('pageshow') as PageTransitionEvent;
    Object.defineProperty(event, 'persisted', { value: persisted });
    window.dispatchEvent(event);
  }

  it('records a page view when the page is restored from bfcache', async () => {
    const router = createFakeRouter();
    analytics.initAnalytics(router);
    router.navigate('/product/a');
    window.history.replaceState({}, '', '/product/a');
    // The visitor leaves for another site and comes back with Back.
    window.dispatchEvent(new Event('pagehide'));
    pageShow(true);
    analytics.flush();

    expect(
      (await sentEvents())
        .filter((e) => e.name === 'page_view')
        .map((e) => e.props.path),
    ).toEqual(['/', '/product/a', '/product/a']);
  });

  it('ignores a normal pageshow; a restore is deduped like any page view', async () => {
    const router = createFakeRouter();
    analytics.initAnalytics(router);
    pageShow(false);
    pageShow(true);
    router.navigate('/');
    analytics.flush();

    expect(
      (await sentEvents())
        .filter((e) => e.name === 'page_view')
        .map((e) => e.props.path),
    ).toEqual(['/', '/']);
  });

  it('does not record a restored staff page', async () => {
    window.history.replaceState({}, '', '/admin/banners');
    analytics.initAnalytics(createFakeRouter());
    pageShow(true);
    analytics.flush();

    expect(await sentEvents()).toEqual([]);
  });
});

describe('entity views', () => {
  it('records product_view once per navigation, even if the effect re-runs', async () => {
    const router = createFakeRouter();
    analytics.initAnalytics(router);
    analytics.trackEntityView('product_view', 'p1');
    analytics.trackEntityView('product_view', 'p1'); // strict-mode double effect
    router.navigate('/product/p1?variant=2', { shallow: true });
    analytics.trackEntityView('product_view', 'p1'); // new navigation
    analytics.trackEntityView('product_view', 'p2');
    analytics.trackEntityView('category_view', 'c1');
    analytics.trackEntityView('category_view', 'c1');
    analytics.flush();

    const views = (await sentEvents()).filter((e) => e.name !== 'page_view');
    expect(views.map((e) => [e.name, e.props])).toEqual([
      ['product_view', { productId: 'p1' }],
      ['product_view', { productId: 'p1' }],
      ['product_view', { productId: 'p2' }],
      ['category_view', { categoryId: 'c1' }],
    ]);
  });

  it('ignores empty ids', async () => {
    analytics.trackEntityView('product_view', '');
    analytics.flush();

    expect(beacon).not.toHaveBeenCalled();
  });
});

describe('useProductView / useCategoryView', () => {
  function ProductPage({ id, tick }: { id?: string; tick: number }) {
    analytics.useProductView(id);
    return createElement('span', null, `${id}-${tick}`);
  }

  it('tracks once per product, not on re-renders', async () => {
    const view = render(createElement(ProductPage, { id: 'p1', tick: 0 }));
    view.rerender(createElement(ProductPage, { id: 'p1', tick: 1 }));
    view.rerender(createElement(ProductPage, { id: 'p1', tick: 2 }));
    view.rerender(createElement(ProductPage, { id: 'p2', tick: 3 }));
    view.rerender(createElement(ProductPage, { id: undefined, tick: 4 }));
    analytics.flush();

    expect((await sentEvents()).map((e) => e.props)).toEqual([
      { productId: 'p1' },
      { productId: 'p2' },
    ]);
  });

  it('deduplicates the StrictMode double mount', async () => {
    render(
      createElement(
        StrictMode,
        null,
        createElement(ProductPage, { id: 'p1', tick: 0 }),
      ),
    );
    analytics.flush();

    expect(await sentEvents()).toHaveLength(1);
  });

  it('tracks again when the same product is opened by a new navigation', async () => {
    const router = createFakeRouter();
    analytics.initAnalytics(router);
    const first = render(createElement(ProductPage, { id: 'p1', tick: 0 }));
    router.navigate('/');
    first.unmount();
    router.navigate('/product/p1');
    render(createElement(ProductPage, { id: 'p1', tick: 1 }));
    analytics.flush();

    const views = (await sentEvents()).filter((e) => e.name === 'product_view');
    expect(views).toHaveLength(2);
  });

  it('records category_view', async () => {
    function CategoryPage({ id }: { id: string }): null {
      analytics.useCategoryView(id);
      return null;
    }
    render(createElement(CategoryPage, { id: 'c1' }));
    analytics.flush();

    expect(await sentEvents()).toEqual([
      {
        name: 'category_view',
        props: { categoryId: 'c1' },
        ts: expect.any(Number),
      },
    ]);
  });
});

describe('staff opt-out', () => {
  it('drops what was queued and tracks nothing more for staff', async () => {
    const router = createFakeRouter('en');
    analytics.initAnalytics(router);
    analytics.track('product_view', { productId: 'p1' });

    // The session loads and turns out to be an admin's.
    analytics.setStaffOptOut(true);
    router.navigate('/en/product/x');
    analytics.track('product_view', { productId: 'p2' });
    analytics.flush();

    expect(await sentEvents()).toEqual([]);
  });

  it('remembers it, so the next page load sends nothing from the start', async () => {
    analytics.setStaffOptOut(true);
    expect(
      window.localStorage.getItem(analytics.STAFF_OPT_OUT_STORAGE_KEY),
    ).toBe('1');

    await reloadPage();
    analytics.initAnalytics(createFakeRouter('en'));
    analytics.track('product_view', { productId: 'p1' });
    analytics.flush();
    expect(await sentEvents()).toEqual([]);
  });

  it('resumes after a staff member signs out', async () => {
    analytics.setStaffOptOut(true);
    analytics.setStaffOptOut(false);
    expect(
      window.localStorage.getItem(analytics.STAFF_OPT_OUT_STORAGE_KEY),
    ).toBeNull();

    analytics.track('product_view', { productId: 'p1' });
    analytics.flush();
    expect((await sentEvents()).map((e) => e.name)).toEqual(['product_view']);
  });
});

describe('never throws', () => {
  it('survives a broken cookie jar, sendBeacon and fetch', () => {
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => {
        throw new Error('cookies blocked');
      },
      set: () => {
        throw new Error('cookies blocked');
      },
    });
    beacon.mockImplementation(() => {
      throw new Error('boom');
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('boom');
      }),
    );

    expect(() =>
      analytics.track('product_view', { productId: 'p1' }),
    ).not.toThrow();
    expect(() => analytics.trackEntityView('product_view', 'p2')).not.toThrow();
    expect(() => analytics.initAnalytics(createFakeRouter())).not.toThrow();
    expect(() => analytics.trackPageView('/x')).not.toThrow();
    expect(() => analytics.flush()).not.toThrow();
    expect(() => window.dispatchEvent(new Event('pagehide'))).not.toThrow();
  });

  it('survives a router whose events throw', () => {
    const router = {
      locale: 'ru',
      events: {
        on: () => {
          throw new Error('nope');
        },
        off: () => {
          throw new Error('nope');
        },
      },
    };
    let teardown: () => void = () => {};
    expect(() => {
      teardown = analytics.initAnalytics(router);
    }).not.toThrow();
    expect(() => teardown()).not.toThrow();
  });
});
