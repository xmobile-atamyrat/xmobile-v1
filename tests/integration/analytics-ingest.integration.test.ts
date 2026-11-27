import { randomUUID } from 'node:crypto';

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, UserRole } from '@prisma/client';
import { createMocks, RequestMethod } from 'node-mocks-http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

const BROWSER =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const ANDROID_WEBVIEW =
  'Mozilla/5.0 (Linux; Android 13; SM-A135F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36';

type Handler = (req: NextApiRequest, res: NextApiResponse) => Promise<unknown>;

// Product and category ids are UUIDs; anything else is dropped at ingest.
const PRODUCT_ID = '0b9a7e6c-3f1d-4e2a-9c8b-7a6d5e4f3a2b';
const CATEGORY_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const KEPT_ID = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a';

describe('POST /api/events (integration)', () => {
  let prisma: PrismaClient;
  let handler: Handler;
  let flush: () => Promise<number>;
  let resetLimits: () => void;
  let resetStaffGrades: () => void;
  let perVisitorLimit: number;
  let perIpLimit: number;
  let enqueue: (row: Record<string, unknown>) => void;

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    const mod = await import('@/pages/api/events.page');
    handler = mod.default as Handler;
    resetLimits = mod.resetEventsRateLimits;
    perVisitorLimit = mod.EVENTS_RATE_LIMIT_PER_VISITOR;
    perIpLimit = mod.EVENTS_RATE_LIMIT_PER_IP;
    const server = await import('@/lib/analytics/server');
    flush = server.flushAnalyticsBuffer;
    enqueue = server.enqueueAnalyticsEvent as unknown as typeof enqueue;
    resetStaffGrades = server.resetStaffGradeCache;
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  beforeEach(() => {
    resetLimits();
    resetStaffGrades();
  });

  async function post({
    body,
    cookies,
    headers = {},
    method = 'POST',
  }: {
    body?: unknown;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
    method?: RequestMethod;
  }) {
    const { req, res } = createMocks({
      method,
      url: '/api/events',
      headers: { 'user-agent': BROWSER, 'x-real-ip': '10.1.2.3', ...headers },
      cookies,
      body: body as Record<string, unknown>,
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    return res;
  }

  const rowsFor = async (visitorId: string) => {
    await flush();
    return prisma.analyticsEvent.findMany({
      where: { visitorId },
      orderBy: { id: 'asc' },
    });
  };

  it('stores a valid batch with the right columns', async () => {
    const vid = randomUUID();
    const sid = randomUUID();
    const ts = Date.now() - 10 * 60_000;
    const res = await post({
      cookies: { xa_vid: vid, xa_sid: sid },
      body: {
        platform: 'APP',
        locale: 'tk',
        events: [
          {
            name: 'page_view',
            props: {
              path: '/tk/product/x',
              referrer: 'google.com',
              device: 'mobile',
            },
            ts,
          },
          { name: 'product_view', props: { productId: PRODUCT_ID }, ts },
          { name: 'category_view', props: { categoryId: CATEGORY_ID }, ts },
        ],
      },
    });
    expect(res._getStatusCode()).toBe(204);
    expect(res._getData()).toBe('');

    const rows = await rowsFor(vid);
    expect(rows).toHaveLength(3);
    rows.forEach((row) => {
      expect(row).toMatchObject({
        visitorId: vid,
        sessionId: sid,
        userId: null,
        platform: 'APP',
        locale: 'tk',
      });
      expect(row.occurredAt.getTime()).toBe(ts);
    });
    expect(rows.map((r) => [r.name, r.entityId, r.props])).toEqual([
      [
        'page_view',
        null,
        { path: '/tk/product/x', referrer: 'google.com', device: 'mobile' },
      ],
      ['product_view', PRODUCT_ID, null],
      ['category_view', CATEGORY_ID, null],
    ]);
  });

  it('accepts a text/plain string body holding JSON', async () => {
    const vid = randomUUID();
    const res = await post({
      cookies: { xa_vid: vid },
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({
        platform: 'WEB',
        locale: 'en',
        events: [{ name: 'page_view', props: { path: '/en' }, ts: Date.now() }],
      }),
    });
    expect(res._getStatusCode()).toBe(204);
    const rows = await rowsFor(vid);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'page_view',
      platform: 'WEB',
      locale: 'en',
      sessionId: null,
    });
  });

  it('drops server-only and invalid events individually and keeps the rest', async () => {
    const vid = randomUUID();
    const res = await post({
      cookies: { xa_vid: vid },
      body: {
        platform: 'WEB',
        locale: 'ru',
        events: [
          { name: 'order_placed', props: { orderId: 'fake' } },
          { name: 'search', props: { q: 'x', results: 0 } },
          { name: 'cart_add', props: { productId: 'p', qty: 1 } },
          { name: 'signup', props: {} },
          { name: 'chat_started', props: {} },
          { name: 'product_view', props: {} },
          { name: 'nonsense', props: {} },
          'not an object',
          { name: 'product_view', props: { productId: 'not-a-uuid' } },
          { name: 'product_view', props: { productId: KEPT_ID } },
        ],
      },
    });
    expect(res._getStatusCode()).toBe(204);
    const rows = await rowsFor(vid);
    expect(rows.map((r) => [r.name, r.entityId])).toEqual([
      ['product_view', KEPT_ID],
    ]);
  });

  it('uses server time for a client timestamp outside [now − 1h, now + 1 min]', async () => {
    const vid = randomUUID();
    const before = Date.now();
    await post({
      cookies: { xa_vid: vid },
      body: {
        platform: 'WEB',
        locale: 'ru',
        events: [
          {
            name: 'page_view',
            props: { path: '/old' },
            ts: before - 2 * 3_600_000,
          },
          {
            name: 'page_view',
            props: { path: '/future' },
            ts: before + 3_600_000,
          },
        ],
      },
    });
    const after = Date.now();
    const rows = await rowsFor(vid);
    expect(rows).toHaveLength(2);
    rows.forEach((row) => {
      expect(row.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(row.occurredAt.getTime()).toBeLessThanOrEqual(after);
    });
  });

  it('falls back to the user agent and NEXT_LOCALE cookie for platform and locale', async () => {
    const vid = randomUUID();
    await post({
      cookies: { xa_vid: vid, NEXT_LOCALE: 'ch' },
      headers: { 'user-agent': ANDROID_WEBVIEW },
      body: {
        platform: 'PHONE',
        locale: 'de',
        events: [{ name: 'page_view', props: { path: '/' } }],
      },
    });
    const [row] = await rowsFor(vid);
    expect(row).toMatchObject({ platform: 'APP', locale: 'ch' });
  });

  it('sets userId from a valid refresh-token cookie and ignores a bad one', async () => {
    const session = await signupTestUser('analytics-ingest');
    const good = randomUUID();
    const bad = randomUUID();
    const body = {
      platform: 'WEB',
      locale: 'ru',
      events: [{ name: 'page_view', props: { path: '/' } }],
    };
    await post({
      cookies: { xa_vid: good, REFRESH_TOKEN: session.refreshToken },
      body,
    });
    await post({
      cookies: { xa_vid: bad, REFRESH_TOKEN: 'forged.token.x' },
      body,
    });

    expect((await rowsFor(good))[0].userId).toBe(session.userId);
    expect((await rowsFor(bad))[0].userId).toBeNull();
  });

  it.each([UserRole.ADMIN, UserRole.SUPERUSER])(
    'drops every event of a %s with a 204',
    async (grade) => {
      const session = await signupTestUser(`analytics-staff-${grade}`);
      await prisma.user.update({
        where: { id: session.userId },
        data: { grade },
      });
      const vid = randomUUID();
      const ts = Date.now();
      const body = {
        platform: 'WEB',
        locale: 'ru',
        events: [
          { name: 'page_view', props: { path: '/' }, ts },
          { name: 'product_view', props: { productId: PRODUCT_ID }, ts },
        ],
      };

      // Twice: the second batch is answered from the grade cache.
      const first = await post({
        cookies: { xa_vid: vid, REFRESH_TOKEN: session.refreshToken },
        body,
      });
      const second = await post({
        cookies: { xa_vid: vid, REFRESH_TOKEN: session.refreshToken },
        body,
      });

      expect(first._getStatusCode()).toBe(204);
      expect(second._getStatusCode()).toBe(204);
      expect(await rowsFor(vid)).toEqual([]);
    },
  );

  it('still records a FREE user once a staff lookup was cached for someone else', async () => {
    const admin = await signupTestUser('analytics-staff-mixed-admin');
    await prisma.user.update({
      where: { id: admin.userId },
      data: { grade: UserRole.ADMIN },
    });
    const customer = await signupTestUser('analytics-staff-mixed-free');
    const adminVid = randomUUID();
    const customerVid = randomUUID();
    const body = {
      platform: 'WEB',
      locale: 'ru',
      events: [{ name: 'page_view', props: { path: '/' } }],
    };
    await post({
      cookies: { xa_vid: adminVid, REFRESH_TOKEN: admin.refreshToken },
      body,
    });
    await post({
      cookies: { xa_vid: customerVid, REFRESH_TOKEN: customer.refreshToken },
      body,
    });

    expect(await rowsFor(adminVid)).toEqual([]);
    const rows = await rowsFor(customerVid);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(customer.userId);
  });

  it('drops a batch without a valid xa_vid cookie with a 204', async () => {
    const body = {
      platform: 'WEB',
      locale: 'ru',
      events: [{ name: 'page_view', props: { path: '/no-cookie' } }],
    };
    const before = await prisma.analyticsEvent.count();
    expect((await post({ body }))._getStatusCode()).toBe(204);
    expect(
      (
        await post({ cookies: { xa_vid: 'not-a-uuid' }, body })
      )._getStatusCode(),
    ).toBe(204);
    await flush();
    expect(await prisma.analyticsEvent.count()).toBe(before);
  });

  it('drops bots with a 204', async () => {
    const vid = randomUUID();
    const body = {
      platform: 'WEB',
      locale: 'ru',
      events: [{ name: 'page_view', props: { path: '/' } }],
    };
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'curl/8.4.0',
      '',
    ]) {
      // eslint-disable-next-line no-await-in-loop
      const res = await post({
        cookies: { xa_vid: vid },
        headers: { 'user-agent': ua },
        body,
      });
      expect(res._getStatusCode()).toBe(204);
    }
    expect(await rowsFor(vid)).toHaveLength(0);
  });

  it('rejects a batch over MAX_EVENTS_PER_BATCH with a 400 and stores none of it', async () => {
    const { MAX_EVENTS_PER_BATCH } = await import('@/lib/analytics/constants');
    const vid = randomUUID();
    const event = { name: 'page_view', props: { path: '/' } };
    const over = await post({
      cookies: { xa_vid: vid },
      body: {
        platform: 'WEB',
        locale: 'ru',
        events: Array(MAX_EVENTS_PER_BATCH + 1).fill(event),
      },
    });
    expect(over._getStatusCode()).toBe(400);
    expect(await rowsFor(vid)).toHaveLength(0);

    const exact = await post({
      cookies: { xa_vid: vid },
      body: {
        platform: 'WEB',
        locale: 'ru',
        events: Array(MAX_EVENTS_PER_BATCH).fill(event),
      },
    });
    expect(exact._getStatusCode()).toBe(204);
    expect(await rowsFor(vid)).toHaveLength(MAX_EVENTS_PER_BATCH);
  });

  it.each([
    ['invalid JSON text', '{"events": [}'],
    ['a JSON array', [{ name: 'page_view' }]],
    ['no events array', { platform: 'WEB', locale: 'ru' }],
    ['events not an array', { events: 'page_view' }],
  ])('answers 400 for %s', async (_label, body) => {
    const res = await post({ cookies: { xa_vid: randomUUID() }, body });
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData() as string).success).toBe(false);
  });

  it.each(['GET', 'PUT', 'DELETE'] as RequestMethod[])(
    'answers 405 to %s',
    async (method) => {
      const res = await post({ method, cookies: { xa_vid: randomUUID() } });
      expect(res._getStatusCode()).toBe(405);
      expect(res.getHeader('Allow')).toBe('POST');
    },
  );

  it('sets the usual CORS headers', async () => {
    const res = await post({ method: 'GET' });
    expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*');
  });

  it('rate-limits a visitor with a 429', async () => {
    const vid = randomUUID();
    const body = {
      platform: 'WEB',
      locale: 'ru',
      events: [{ name: 'page_view', props: { path: '/' } }],
    };
    const statuses: number[] = [];
    for (let i = 0; i < perVisitorLimit + 2; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      statuses.push(
        (await post({ cookies: { xa_vid: vid }, body }))._getStatusCode(),
      );
    }
    expect(statuses.slice(0, perVisitorLimit).every((s) => s === 204)).toBe(
      true,
    );
    expect(statuses.slice(perVisitorLimit)).toEqual([429, 429]);
    expect(await rowsFor(vid)).toHaveLength(perVisitorLimit);

    // Another visitor on the same address is unaffected.
    const other = await post({ cookies: { xa_vid: randomUUID() }, body });
    expect(other._getStatusCode()).toBe(204);
  });

  it('declares a small body size limit', async () => {
    const { config } = await import('@/pages/api/events.page');
    expect(config.api.bodyParser.sizeLimit).toBe('64kb');
  });

  describe('strings Postgres rejects', () => {
    it('stores a batch with NUL and lone surrogates, cleaned, next to other visitors', async () => {
      const vid = randomUUID();
      const neighbour = randomUUID();
      // Both batches land in the same multi-row insert.
      await post({
        cookies: { xa_vid: neighbour },
        body: {
          platform: 'WEB',
          locale: 'ru',
          events: [{ name: 'page_view', props: { path: '/fine' } }],
        },
      });
      const res = await post({
        cookies: { xa_vid: vid },
        body: {
          platform: 'WEB',
          locale: 'ru',
          events: [
            { name: 'page_view', props: { path: '/a\u0000b' } },
            { name: 'page_view', props: { path: '/c\uD83Dd' } },
            { name: 'page_view', props: { path: '/e\uDE00' } },
            {
              name: 'product_view',
              props: { productId: `${PRODUCT_ID}\u0000` },
            },
            {
              name: 'product_view',
              props: { productId: `${PRODUCT_ID}\uD83D` },
            },
          ],
        },
      });
      expect(res._getStatusCode()).toBe(204);
      const rows = await rowsFor(vid);
      expect(rows.map((r) => [r.name, r.entityId, r.props])).toEqual([
        ['page_view', null, { path: '/ab' }],
        ['page_view', null, { path: '/c\uFFFDd' }],
        ['page_view', null, { path: '/e\uFFFD' }],
        ['product_view', PRODUCT_ID, null],
      ]);
      expect(await rowsFor(neighbour)).toHaveLength(1);
    });

    it('a row that still fails the insert only drops itself', async () => {
      // Bypasses ingest sanitizing, as a future bug might.
      const vid = randomUUID();
      const base = {
        visitorId: vid,
        platform: 'WEB',
        locale: 'ru',
        occurredAt: new Date(),
      };
      const error = console.error;
      console.error = () => undefined;
      try {
        enqueue({ ...base, name: 'page_view', props: { path: '/1' } });
        enqueue({ ...base, name: 'page_view', props: { path: 'bad\u0000' } });
        enqueue({ ...base, name: 'page_view', props: { path: '/2' } });
        enqueue({ ...base, name: 'page_view', entityId: 'nul\u0000' });
        enqueue({ ...base, name: 'page_view', props: { path: '/3' } });
        expect(await flush()).toBe(3);
      } finally {
        console.error = error;
      }
      const rows = await rowsFor(vid);
      expect(rows.map((r) => (r.props as { path: string }).path)).toEqual([
        '/1',
        '/2',
        '/3',
      ]);
    });
  });

  it('drops a referrer that is not a host name and keeps the page view', async () => {
    const vid = randomUUID();
    await post({
      cookies: { xa_vid: vid },
      body: {
        platform: 'WEB',
        locale: 'ru',
        events: [
          {
            name: 'page_view',
            props: { path: '/', referrer: '<script>alert(1)</script>' },
          },
          { name: 'page_view', props: { path: '/x', referrer: 'yandex.ru' } },
        ],
      },
    });
    expect((await rowsFor(vid)).map((r) => r.props)).toEqual([
      { path: '/' },
      { path: '/x', referrer: 'yandex.ru' },
    ]);
  });

  it('puts client timestamps on the server clock using sentAt', async () => {
    const vid = randomUUID();
    // A phone whose clock is a day behind, and one 3 hours ahead.
    const behind = Date.now() - 86_400_000;
    const ahead = Date.now() + 3 * 3_600_000;
    const before = Date.now();
    await post({
      cookies: { xa_vid: vid },
      body: {
        platform: 'WEB',
        locale: 'ru',
        sentAt: behind,
        events: [
          { name: 'page_view', props: { path: '/a' }, ts: behind - 20_000 },
        ],
      },
    });
    await post({
      cookies: { xa_vid: vid },
      body: {
        platform: 'WEB',
        locale: 'ru',
        sentAt: ahead,
        events: [
          { name: 'page_view', props: { path: '/b' }, ts: ahead - 5_000 },
        ],
      },
    });
    const after = Date.now();
    const rows = await rowsFor(vid);
    expect(rows).toHaveLength(2);
    const [a, b] = rows.map((r) => r.occurredAt.getTime());
    expect(a).toBeGreaterThanOrEqual(before - 20_000);
    expect(a).toBeLessThanOrEqual(after - 20_000);
    expect(b).toBeGreaterThanOrEqual(before - 5_000);
    expect(b).toBeLessThanOrEqual(after - 5_000);
  });

  it('records a soft-deleted user anonymously', async () => {
    const session = await signupTestUser('analytics-ingest-deleted');
    await prisma.user.update({
      where: { id: session.userId },
      data: { deletedAt: new Date() },
    });
    const vid = randomUUID();
    const res = await post({
      cookies: { xa_vid: vid, REFRESH_TOKEN: session.refreshToken },
      body: {
        platform: 'WEB',
        locale: 'ru',
        events: [{ name: 'page_view', props: { path: '/' } }],
      },
    });
    expect(res._getStatusCode()).toBe(204);
    const rows = await rowsFor(vid);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBeNull();
  });

  describe('visitor cookie renewal', () => {
    const body = {
      platform: 'WEB',
      locale: 'ru',
      events: [{ name: 'page_view', props: { path: '/' } }],
    };

    it('re-issues a valid xa_vid with the client attributes', async () => {
      const vid = randomUUID();
      const res = await post({ cookies: { xa_vid: vid }, body });
      const header = String(res.getHeader('Set-Cookie'));
      expect(header).toContain(`xa_vid=${vid}`);
      expect(header).toContain('Max-Age=31536000');
      expect(header).toContain('Path=/');
      expect(header).toContain('SameSite=Lax');
      expect(header).not.toContain('HttpOnly');
      expect(header).not.toContain('Secure');
    });

    it('marks it Secure on https', async () => {
      const vid = randomUUID();
      const res = await post({
        cookies: { xa_vid: vid },
        headers: { 'x-forwarded-proto': 'https' },
        body,
      });
      expect(String(res.getHeader('Set-Cookie'))).toContain('Secure');
    });

    it.each([
      ['no cookie', {}],
      ['an invalid one', { xa_vid: 'not-a-uuid' }],
    ])('never mints an id (%s)', async (_label, cookies) => {
      const res = await post({ cookies, body });
      expect(res.getHeader('Set-Cookie')).toBeUndefined();
    });

    it('does not set cookies for bots', async () => {
      const res = await post({
        cookies: { xa_vid: randomUUID() },
        headers: { 'user-agent': 'curl/8.0' },
        body,
      });
      expect(res.getHeader('Set-Cookie')).toBeUndefined();
    });
  });

  describe('per-address limits', () => {
    const batch = (n: number) => ({
      platform: 'WEB',
      locale: 'ru',
      events: Array.from({ length: n }, (_v, i) => ({
        name: 'page_view',
        props: { path: `/${i}` },
      })),
    });

    it('limits events, not requests, so rotating xa_vid does not help', async () => {
      const headers = { 'x-real-ip': '10.9.9.9' };
      const statuses: number[] = [];
      const vids: string[] = [];
      // 50-event batches, a fresh visitor id every time.
      for (let sent = 0; sent < perIpLimit + 100; sent += 50) {
        const vid = randomUUID();
        vids.push(vid);
        statuses.push(
          // eslint-disable-next-line no-await-in-loop
          (
            await post({ cookies: { xa_vid: vid }, headers, body: batch(50) })
          )._getStatusCode(),
        );
      }
      const allowed = Math.floor(perIpLimit / 50);
      expect(statuses.slice(0, allowed).every((s) => s === 204)).toBe(true);
      expect(statuses.slice(allowed).every((s) => s === 429)).toBe(true);
      await flush();
      expect(
        await prisma.analyticsEvent.count({
          where: { visitorId: { in: vids } },
        }),
      ).toBe(allowed * 50);

      // Another address is unaffected.
      const other = await post({
        cookies: { xa_vid: randomUUID() },
        headers: { 'x-real-ip': '10.9.9.10' },
        body: batch(1),
      });
      expect(other._getStatusCode()).toBe(204);
    });

    it('has a daily per-address cap above the per-minute one', async () => {
      const mod = await import('@/pages/api/events.page');
      expect(mod.EVENTS_DAILY_LIMIT_PER_IP).toBeGreaterThan(perIpLimit);
    });
  });
});
