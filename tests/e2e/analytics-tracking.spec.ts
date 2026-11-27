import { expect, test, type Page, type Request } from '@playwright/test';

import { E2E_CATALOG } from './fixtures/catalog-slugs';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface WireEvent {
  name: string;
  props: Record<string, unknown>;
  ts: number;
}

interface EventsPayload {
  platform: 'WEB' | 'APP';
  locale: string;
  sentAt: number;
  events: WireEvent[];
}

interface BeaconLog {
  /** Number of POST /api/events requests seen on the network. */
  requests: () => number;
  /** Bodies of those requests, in order. */
  payloads: () => Promise<EventsPayload[]>;
}

/**
 * Observes POST /api/events. Playwright doesn't expose the body of a
 * `sendBeacon` Blob, so an init script records what the page hands to
 * sendBeacon / fetch (and still sends it), while the network listener proves
 * the request actually went out.
 */
async function watchBeacons(page: Page): Promise<BeaconLog> {
  await page.addInitScript(() => {
    const w = window as any;
    w.xaBeaconBodies = [];
    const isEvents = (url: unknown) =>
      new URL(String(url), window.location.href).pathname === '/api/events';
    const originalBeacon = navigator.sendBeacon?.bind(navigator);
    if (originalBeacon) {
      navigator.sendBeacon = (url, data) => {
        if (isEvents(url) && data instanceof Blob) {
          const slot = w.xaBeaconBodies.length;
          w.xaBeaconBodies.push(null);
          data.text().then((text: string) => {
            w.xaBeaconBodies[slot] = text;
          });
        }
        return originalBeacon(url, data);
      };
    }
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (isEvents(input) && typeof init?.body === 'string') {
        w.xaBeaconBodies.push(init.body);
      }
      return originalFetch(input, init);
    };
  });
  let requests = 0;
  page.on('request', (request: Request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/events'
    ) {
      requests += 1;
    }
  });
  return {
    requests: () => requests,
    payloads: async () =>
      (
        (await page.evaluate(() => (window as any).xaBeaconBodies)) as (
          | string
          | null
        )[]
      )
        .filter((body): body is string => body != null)
        .map((body) => JSON.parse(body)),
  };
}

/** What the tracker does when the tab is backgrounded. */
async function hidePage(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

/** A real client-side navigation through the Next router. */
async function routerPush(page: Page, url: string) {
  await page.evaluate(
    (target) => (window as any).next.router.push(target),
    url,
  );
}

const summarize = (payloads: EventsPayload[]) =>
  payloads
    .flatMap((payload) => payload.events)
    .map(({ name, props }) =>
      name === 'page_view'
        ? `page_view ${props.path}`
        : `${name} ${props.productId ?? props.categoryId}`,
    );

test.describe('Analytics tracking', () => {
  test('batches page, category and product views into one beacon', async ({
    page,
    context,
  }) => {
    const beacons = await watchBeacons(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect
      .poll(async () => (await context.cookies()).map((c) => c.name))
      .toContain('xa_vid');

    await routerPush(page, `/category/${E2E_CATALOG.rootSlug}`);
    await expect(
      page.getByText(E2E_CATALOG.subName, { exact: false }).first(),
    ).toBeVisible({ timeout: 60_000 });

    await routerPush(page, `/product-category/${E2E_CATALOG.subSlug}`);
    await expect(
      page.getByText(E2E_CATALOG.productName, { exact: false }).first(),
    ).toBeVisible({ timeout: 60_000 });

    await routerPush(page, `/product/${E2E_CATALOG.productSlug}`);
    await expect(page).toHaveURL(
      new RegExp(`/product/${E2E_CATALOG.productSlug}$`),
    );
    await expect(
      page.getByText(E2E_CATALOG.productName, { exact: false }).first(),
    ).toBeVisible({ timeout: 60_000 });

    const beaconSent = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        new URL(request.url()).pathname === '/api/events',
    );
    await hidePage(page);
    await beaconSent;

    // A slow first compile in `next dev` can let the 30s timer flush part of
    // the queue early, so compare the events across every beacon in order.
    await expect
      .poll(async () => summarize(await beacons.payloads()))
      .toEqual([
        'page_view /',
        `category_view ${E2E_CATALOG.rootUuid}`,
        `page_view /category/${E2E_CATALOG.rootSlug}`,
        `category_view ${E2E_CATALOG.subUuid}`,
        `page_view /product-category/${E2E_CATALOG.subSlug}`,
        `product_view ${E2E_CATALOG.productUuid}`,
        `page_view /product/${E2E_CATALOG.productSlug}`,
      ]);

    const payloads = await beacons.payloads();
    expect(beacons.requests()).toBe(payloads.length);
    payloads.forEach((payload) => {
      expect(payload.platform).toBe('WEB');
      expect(payload.locale).toBe('ru');
      // The send time, on the same clock as ts, for skew correction.
      expect(typeof payload.sentAt).toBe('number');
      payload.events.forEach((event) => {
        expect(typeof event.ts).toBe('number');
        expect(event.ts).toBeLessThanOrEqual(payload.sentAt);
      });
    });
    const pageView = payloads[0].events.find((e) => e.name === 'page_view')!;
    expect(pageView.props).toEqual({ path: '/', device: 'desktop' });

    const cookies = await context.cookies();
    const vid = cookies.find((c) => c.name === 'xa_vid');
    const sid = cookies.find((c) => c.name === 'xa_sid');
    expect(vid?.value).toMatch(UUID_RE);
    expect(sid?.value).toMatch(UUID_RE);
    expect(vid?.path).toBe('/');
    expect(vid?.sameSite).toBe('Lax');
    const nowS = Date.now() / 1000;
    // ~1 year and ~30 minutes from now.
    expect(vid!.expires - nowS).toBeGreaterThan(364 * 24 * 3600);
    expect(sid!.expires - nowS).toBeGreaterThan(29 * 60);
    expect(sid!.expires - nowS).toBeLessThanOrEqual(30 * 60 + 5);

    // Hiding again with an empty queue sends nothing.
    const before = beacons.requests();
    await hidePage(page);
    await page.waitForTimeout(500);
    expect(beacons.requests()).toBe(before);

    // The receiver stores the rows (its buffer flushes every few seconds).
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
    try {
      await expect
        .poll(
          async () =>
            (
              await prisma.analyticsEvent.findMany({
                where: { visitorId: vid!.value },
                orderBy: { id: 'asc' },
                select: {
                  name: true,
                  entityId: true,
                  sessionId: true,
                  platform: true,
                  locale: true,
                },
              })
            ).map((row) => `${row.name} ${row.entityId ?? ''}`.trim()),
          { timeout: 30_000 },
        )
        .toEqual([
          'page_view',
          `category_view ${E2E_CATALOG.rootUuid}`,
          'page_view',
          `category_view ${E2E_CATALOG.subUuid}`,
          'page_view',
          `product_view ${E2E_CATALOG.productUuid}`,
          'page_view',
        ]);
      const rows = await prisma.analyticsEvent.findMany({
        where: { visitorId: vid!.value },
      });
      rows.forEach((row) => {
        expect(row.sessionId).toBe(sid!.value);
        expect(row.platform).toBe('WEB');
        expect(row.locale).toBe('ru');
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  test('tags the mobile WebView as APP and skips staff pages', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Linux; Android 13; SM-A515F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36',
      locale: 'ru',
      timezoneId: 'Asia/Ashgabat',
    });
    // react-native-webview defines this before any page script runs; it, not
    // the `; wv)` user agent, is what marks our app (other apps' in-app
    // browsers have that UA too).
    await context.addInitScript(() => {
      (
        window as unknown as { ReactNativeWebView: unknown }
      ).ReactNativeWebView = { postMessage: (): void => undefined };
    });
    try {
      const page = await context.newPage();
      const beacons = await watchBeacons(page);

      await page.goto(`/en/product/${E2E_CATALOG.productSlug}`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(
        page.getByText(E2E_CATALOG.productName, { exact: false }).first(),
      ).toBeVisible({ timeout: 60_000 });
      // Staff pages are never tracked. (The page may then send a guest
      // elsewhere; that page view is fine, the admin one must not appear.)
      await routerPush(page, '/admin/banners');
      await page.waitForTimeout(1_500);

      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));

      await expect
        .poll(async () => summarize(await beacons.payloads()).slice(0, 2))
        .toEqual([
          `product_view ${E2E_CATALOG.productUuid}`,
          `page_view /product/${E2E_CATALOG.productSlug}`,
        ]);
      const payloads = await beacons.payloads();
      expect(
        summarize(payloads).filter((line) => line.includes('/admin')),
      ).toEqual([]);
      expect(payloads[0].platform).toBe('APP');
      expect(payloads[0].locale).toBe('en');
      const pageView = payloads[0].events.find((e) => e.name === 'page_view')!;
      expect(pageView.props.device).toBe('mobile');
    } finally {
      await context.close();
    }
  });
});
