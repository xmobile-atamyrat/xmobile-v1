import { randomUUID } from 'node:crypto';

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, UserRole } from '@prisma/client';
import { createMocks, RequestMethod } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

const BROWSER =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown;

async function call(
  handler: Handler,
  {
    method = 'POST',
    url = '/',
    body,
    query,
    cookies = {},
    headers = {},
    token,
  }: {
    method?: RequestMethod;
    url?: string;
    body?: Record<string, unknown>;
    query?: Record<string, string>;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
    token?: string;
  },
) {
  const { req, res } = createMocks({
    method,
    url,
    body,
    query,
    cookies,
    headers: {
      'user-agent': BROWSER,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  await handler(
    req as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  );
  const raw = res._getData() as string;
  return {
    status: res._getStatusCode(),
    json: raw ? JSON.parse(raw) : null,
    res,
  };
}

describe('server-side analytics events (integration)', () => {
  let prisma: PrismaClient;
  let productId: string;
  let flush: () => Promise<number>;

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    productId = catalog.productId;
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    flush = (await import('@/lib/analytics/server')).flushAnalyticsBuffer;
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  const eventsFor = async (visitorId: string) => {
    await flush();
    return prisma.analyticsEvent.findMany({
      where: { visitorId },
      orderBy: { id: 'asc' },
    });
  };

  it('signup records a signup event for the new account', async () => {
    const signup = (await import('@/pages/api/user/signup.page')).default;
    const vid = randomUUID();
    const sid = randomUUID();
    const { status, json } = await call(signup, {
      url: '/api/user/signup',
      cookies: { xa_vid: vid, xa_sid: sid, NEXT_LOCALE: 'en' },
      body: {
        email: `analytics-signup-${Date.now()}@test.local`,
        name: 'Analytics',
        password: 'Secret1!x',
        phoneNumber: '+1000',
      },
    });
    expect(status).toBe(200);
    const rows = await eventsFor(vid);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'signup',
      userId: json.data.user.id,
      sessionId: sid,
      platform: 'WEB',
      locale: 'en',
      entityId: null,
      props: null,
    });
  });

  it('a failed signup (duplicate email) records nothing', async () => {
    const signup = (await import('@/pages/api/user/signup.page')).default;
    const existing = await signupTestUser('analytics-dup');
    const vid = randomUUID();
    const { status } = await call(signup, {
      url: '/api/user/signup',
      cookies: { xa_vid: vid },
      body: {
        email: existing.email,
        name: 'x',
        password: 'Secret1!x',
        phoneNumber: '+1',
      },
    });
    expect(status).toBe(400);
    expect(await eventsFor(vid)).toHaveLength(0);
  });

  it('cart add (signed in) records cart_add on add only, then order_placed', async () => {
    const session = await signupTestUser('analytics-cart');
    const cart = (await import('@/pages/api/cart.page')).default;
    const order = (await import('@/pages/api/order/index.page')).default;
    const vid = randomUUID();
    const cookies = { xa_vid: vid };

    const add = await call(cart, {
      url: '/api/cart',
      token: session.accessToken,
      cookies,
      body: { productId, quantity: 2 },
    });
    expect(add.status).toBe(200);

    // A duplicate add (400) and a quantity edit (PUT) are not cart_add.
    const dup = await call(cart, {
      url: '/api/cart',
      token: session.accessToken,
      cookies,
      body: { productId, quantity: 1 },
    });
    expect(dup.status).toBe(400);
    const list = await call(cart, {
      method: 'GET',
      url: '/api/cart',
      token: session.accessToken,
      cookies,
    });
    const put = await call(cart, {
      method: 'PUT',
      url: '/api/cart',
      token: session.accessToken,
      cookies,
      body: { id: list.json.data[0].id, quantity: 4 },
    });
    expect(put.status).toBe(200);

    const placed = await call(order, {
      url: '/api/order',
      token: session.accessToken,
      cookies,
      body: {
        deliveryAddress: '1 Analytics Street',
        deliveryPhone: '+99361000777',
        notes: 'analytics',
      },
    });
    expect(placed.status).toBe(200);
    const orderId = placed.json.data.id;

    const rows = await eventsFor(vid);
    expect(rows.map((r) => [r.name, r.entityId, r.props, r.userId])).toEqual([
      ['cart_add', productId, { qty: 2 }, session.userId],
      ['order_placed', orderId, null, session.userId],
    ]);
  });

  it.each([UserRole.ADMIN, UserRole.SUPERUSER])(
    'records nothing for a %s adding to the cart or starting a chat',
    async (grade) => {
      const staff = await createStaffPrincipal(prisma, grade);
      const cart = (await import('@/pages/api/cart.page')).default;
      const vid = randomUUID();

      const add = await call(cart, {
        url: '/api/cart',
        token: staff.accessToken,
        cookies: { xa_vid: vid },
        body: { productId, quantity: 1 },
      });
      expect(add.status).toBe(200);

      const { trackServer } = await import('@/lib/analytics/server');
      const { req } = createMocks({
        headers: { 'user-agent': BROWSER },
        cookies: { xa_vid: vid },
      });
      // Answered from the grade cache this time.
      trackServer(req, 'chat_started', {}, { userId: staff.userId });

      expect(await eventsFor(vid)).toEqual([]);
      await prisma.user.delete({ where: { id: staff.userId } });
    },
  );

  it('re-adding a hidden cart line counts as an add', async () => {
    const session = await signupTestUser('analytics-cart-hidden');
    const cart = (await import('@/pages/api/cart.page')).default;
    await prisma.cartItem.create({
      data: { userId: session.userId, productId, quantity: 0 },
    });
    const vid = randomUUID();
    const add = await call(cart, {
      url: '/api/cart',
      token: session.accessToken,
      cookies: { xa_vid: vid },
      body: { productId, quantity: 1 },
    });
    expect(add.status).toBe(200);
    const rows = await eventsFor(vid);
    expect(rows.map((r) => [r.name, r.props])).toEqual([
      ['cart_add', { qty: 1 }],
    ]);
  });

  it('guest cart add and guest checkout record cart_add and order_placed without a user', async () => {
    const guestCart = (await import('@/pages/api/guest/cart.page')).default;
    const guestOrder = (await import('@/pages/api/guest/order/index.page'))
      .default;
    const vid = randomUUID();
    const guestSessionId = randomUUID();
    const cookies = { xa_vid: vid, GUEST_SESSION_ID: guestSessionId };

    const add = await call(guestCart, {
      url: '/api/guest/cart',
      cookies,
      body: { productId, quantity: 3 },
    });
    expect(add.status).toBe(200);
    const placed = await call(guestOrder, {
      url: '/api/guest/order',
      cookies,
      body: {
        userName: 'Guest',
        deliveryAddress: 'Guest street',
        deliveryPhone: '+99361000000',
      },
    });
    expect(placed.status).toBe(200);

    const rows = await eventsFor(vid);
    expect(rows.map((r) => [r.name, r.entityId, r.props, r.userId])).toEqual([
      ['cart_add', productId, { qty: 3 }, null],
      ['order_placed', placed.json.data.id, null, null],
    ]);
  });

  it('nothing is recorded without an xa_vid cookie or for a bot', async () => {
    const guestCart = (await import('@/pages/api/guest/cart.page')).default;
    const before = await prisma.analyticsEvent.count({
      where: { name: 'cart_add' },
    });
    const noCookie = await call(guestCart, {
      url: '/api/guest/cart',
      cookies: { GUEST_SESSION_ID: randomUUID() },
      body: { productId, quantity: 1 },
    });
    expect(noCookie.status).toBe(200);
    const bot = await call(guestCart, {
      url: '/api/guest/cart',
      cookies: { GUEST_SESSION_ID: randomUUID(), xa_vid: randomUUID() },
      headers: { 'user-agent': 'curl/8.4.0' },
      body: { productId, quantity: 1 },
    });
    expect(bot.status).toBe(200);
    await flush();
    expect(
      await prisma.analyticsEvent.count({ where: { name: 'cart_add' } }),
    ).toBe(before);
  });

  it('chat session start records chat_started', async () => {
    const session = await signupTestUser('analytics-chat');
    const chat = (await import('@/pages/api/chat/session.page')).default;
    const vid = randomUUID();
    const created = await call(chat, {
      url: '/api/chat/session',
      token: session.accessToken,
      cookies: { xa_vid: vid },
    });
    expect(created.status).toBe(201);
    // A second POST finds the open session (409): not a new chat.
    const again = await call(chat, {
      url: '/api/chat/session',
      token: session.accessToken,
      cookies: { xa_vid: vid },
    });
    expect(again.status).toBe(409);

    const rows = await eventsFor(vid);
    expect(rows.map((r) => [r.name, r.userId, r.props])).toEqual([
      ['chat_started', session.userId, null],
    ]);
    await prisma.chatSession.delete({ where: { id: created.json.data.id } });
  });

  describe('search', () => {
    const search = async (
      query: Record<string, string>,
      opts: { cookies?: Record<string, string>; token?: string } = {},
    ) => {
      const products = (await import('@/pages/api/product/index.page')).default;
      return call(products, {
        method: 'GET',
        url: '/api/product',
        query,
        ...opts,
      });
    };

    it('records the normalised term and the result count for page 1', async () => {
      const vid = randomUUID();
      const res = await search(
        { searchKeyword: '  INTEGRATION   Phone ', page: '1', locale: 'en' },
        { cookies: { xa_vid: vid } },
      );
      expect(res.status).toBe(200);
      const rows = await eventsFor(vid);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        name: 'search',
        entityId: null,
        userId: null,
        props: {
          q: 'integration phone',
          results: res.json.data.length,
        },
      });
      expect(res.json.data.length).toBeGreaterThan(0);
    });

    it('records zero-result searches', async () => {
      const vid = randomUUID();
      const res = await search(
        { searchKeyword: 'zzqx-no-such-product' },
        { cookies: { xa_vid: vid } },
      );
      expect(res.json.data).toEqual([]);
      const rows = await eventsFor(vid);
      expect(rows.map((r) => r.props)).toEqual([
        { q: 'zzqx-no-such-product', results: 0 },
      ]);
    });

    it('skips later pages, count/facet requests, empty terms and staff', async () => {
      const vid = randomUUID();
      const cookies = { xa_vid: vid };
      await search({ searchKeyword: 'integration', page: '2' }, { cookies });
      await search(
        { searchKeyword: 'integration', count: 'true' },
        { cookies },
      );
      await search(
        { searchKeyword: 'integration', facets: 'categories' },
        { cookies },
      );
      await search({ searchKeyword: '   ', page: '1' }, { cookies });
      await search({ page: '1' }, { cookies });
      const staff = await createStaffPrincipal(prisma, 'ADMIN');
      await search(
        { searchKeyword: 'integration', page: '1' },
        { cookies, token: staff.accessToken },
      );
      expect(await eventsFor(vid)).toHaveLength(0);
      await prisma.user.delete({ where: { id: staff.userId } });
    });

    it('skips a staff user identified only by the refresh cookie', async () => {
      const session = await signupTestUser('analytics-search-staff');
      await prisma.user.update({
        where: { id: session.userId },
        data: { grade: UserRole.ADMIN },
      });
      const vid = randomUUID();
      await search(
        { searchKeyword: 'integration', page: '1' },
        { cookies: { xa_vid: vid, REFRESH_TOKEN: session.refreshToken } },
      );
      expect(await eventsFor(vid)).toEqual([]);
    });

    it('counts a repeated term once and reads userId from the refresh cookie', async () => {
      const session = await signupTestUser('analytics-search');
      const vid = randomUUID();
      const cookies = { xa_vid: vid, REFRESH_TOKEN: session.refreshToken };
      await search({ searchKeyword: 'integration', page: '1' }, { cookies });
      await flush();
      await search(
        { searchKeyword: 'integration', page: '1', sortBy: 'price_asc' },
        { cookies },
      );
      const rows = await eventsFor(vid);
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(session.userId);
    });

    it('keeps only the last term of search-as-you-type', async () => {
      const vid = randomUUID();
      const cookies = { xa_vid: vid };
      await search({ searchKeyword: 'int', page: '1' }, { cookies });
      await search({ searchKeyword: 'integ', page: '1' }, { cookies });
      await search({ searchKeyword: 'integration', page: '1' }, { cookies });
      const rows = await eventsFor(vid);
      expect(rows.map((r) => (r.props as { q: string }).q)).toEqual([
        'integration',
      ]);
    });
  });

  describe('tracking failures never break a handler', () => {
    it('a database error while flushing is swallowed', async () => {
      const guestCart = (await import('@/pages/api/guest/cart.page')).default;
      const dbClient = (await import('@/lib/dbClient')).default;
      const spy = vi
        .spyOn(dbClient.analyticsEvent, 'createMany')
        .mockRejectedValue(new Error('db down'));
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const vid = randomUUID();
        const res = await call(guestCart, {
          url: '/api/guest/cart',
          cookies: { xa_vid: vid, GUEST_SESSION_ID: randomUUID() },
          body: { productId, quantity: 1 },
        });
        expect(res.status).toBe(200);
        await expect(flush()).resolves.toBe(0);
        expect(error).toHaveBeenCalled();
      } finally {
        spy.mockRestore();
        error.mockRestore();
      }
      // And the next flush works again.
      const vid = randomUUID();
      await call(guestCart, {
        url: '/api/guest/cart',
        cookies: { xa_vid: vid, GUEST_SESSION_ID: randomUUID() },
        body: { productId, quantity: 1 },
      });
      expect(await eventsFor(vid)).toHaveLength(1);
    });

    it('an exception inside tracking leaves the response untouched', async () => {
      vi.resetModules();
      vi.doMock('@/lib/analytics/server/buffer', async (importOriginal) => ({
        ...(await importOriginal<
          typeof import('@/lib/analytics/server/buffer')
        >()),
        enqueueAnalyticsEvent: () => {
          throw new Error('tracking exploded');
        },
      }));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const guestCart = (await import('@/pages/api/guest/cart.page')).default;
        const guestOrder = (await import('@/pages/api/guest/order/index.page'))
          .default;
        const cookies = {
          xa_vid: randomUUID(),
          GUEST_SESSION_ID: randomUUID(),
        };
        const add = await call(guestCart, {
          url: '/api/guest/cart',
          cookies,
          body: { productId, quantity: 1 },
        });
        expect(add.status).toBe(200);
        expect(add.json).toEqual({ success: true, data: { quantity: 1 } });
        const placed = await call(guestOrder, {
          url: '/api/guest/order',
          cookies,
          body: {
            userName: 'Guest',
            deliveryAddress: 'Guest street',
            deliveryPhone: '+99361000000',
          },
        });
        expect(placed.status).toBe(200);
        expect(placed.json.success).toBe(true);
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining('[analytics] trackServer'),
          expect.any(Error),
        );
      } finally {
        warn.mockRestore();
        vi.doUnmock('@/lib/analytics/server/buffer');
        vi.resetModules();
      }
    });
  });
});
