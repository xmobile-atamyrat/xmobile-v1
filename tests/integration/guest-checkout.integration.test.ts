import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Guest checkout flow (integration)', () => {
  let prisma: PrismaClient;
  let productId: string;
  let guestSessionId: string;

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    productId = catalog.productId;
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('supports guest cart CRUD and guest order creation', async () => {
    const guestCartHandler = (await import('@/pages/api/guest/cart.page'))
      .default;
    const guestOrderHandler = (
      await import('@/pages/api/guest/order/index.page')
    ).default;

    const add = createMocks({
      method: 'POST',
      url: '/api/guest/cart',
      body: { productId, quantity: 2 },
    });
    await guestCartHandler(
      add.req as unknown as NextApiRequest,
      add.res as unknown as NextApiResponse,
    );
    expect(add.res._getStatusCode()).toBe(200);
    const setCookie = add.res.getHeader('Set-Cookie') as string;
    expect(setCookie).toContain('GUEST_SESSION_ID=');
    guestSessionId = /GUEST_SESSION_ID=([^;]+)/.exec(setCookie)?.[1] as string;
    expect(guestSessionId).toBeTruthy();

    const dup = createMocks({
      method: 'POST',
      url: '/api/guest/cart',
      cookies: { GUEST_SESSION_ID: guestSessionId },
      body: { productId, quantity: 1 },
    });
    await guestCartHandler(
      dup.req as unknown as NextApiRequest,
      dup.res as unknown as NextApiResponse,
    );
    expect(dup.res._getStatusCode()).toBe(400);

    const list = createMocks({
      method: 'GET',
      url: '/api/guest/cart',
      cookies: { GUEST_SESSION_ID: guestSessionId },
    });
    await guestCartHandler(
      list.req as unknown as NextApiRequest,
      list.res as unknown as NextApiResponse,
    );
    expect(list.res._getStatusCode()).toBe(200);
    const listData = JSON.parse(list.res._getData() as string).data;
    expect(listData.length).toBe(1);
    const guestCartItemId = listData[0].id;

    const update = createMocks({
      method: 'PUT',
      url: '/api/guest/cart',
      cookies: { GUEST_SESSION_ID: guestSessionId },
      body: { id: guestCartItemId, quantity: 5 },
    });
    await guestCartHandler(
      update.req as unknown as NextApiRequest,
      update.res as unknown as NextApiResponse,
    );
    expect(update.res._getStatusCode()).toBe(200);

    const createOrder = createMocks({
      method: 'POST',
      url: '/api/guest/order',
      cookies: { GUEST_SESSION_ID: guestSessionId },
      body: {
        userName: 'Guest User',
        deliveryAddress: 'Guest street',
        deliveryPhone: '+7000000',
      },
    });
    await guestOrderHandler(
      createOrder.req as unknown as NextApiRequest,
      createOrder.res as unknown as NextApiResponse,
    );
    expect(createOrder.res._getStatusCode()).toBe(200);
    const orderJson = JSON.parse(createOrder.res._getData() as string).data;
    expect(orderJson.userId).toBeNull();
    expect(orderJson.guestSessionId).toBe(guestSessionId);

    const emptyCart = createMocks({
      method: 'GET',
      url: '/api/guest/cart',
      cookies: { GUEST_SESSION_ID: guestSessionId },
    });
    await guestCartHandler(
      emptyCart.req as unknown as NextApiRequest,
      emptyCart.res as unknown as NextApiResponse,
    );
    expect(JSON.parse(emptyCart.res._getData() as string).data.length).toBe(0);
  });

  it('allows guest to cancel own order and blocks other guest session', async () => {
    const guestCartHandler = (await import('@/pages/api/guest/cart.page'))
      .default;
    const guestOrderHandler = (
      await import('@/pages/api/guest/order/index.page')
    ).default;
    const guestOrderDetailHandler = (
      await import('@/pages/api/guest/order/[id].page')
    ).default;

    const addGuestCart = createMocks({
      method: 'POST',
      url: '/api/guest/cart',
      cookies: { GUEST_SESSION_ID: guestSessionId },
      body: { productId, quantity: 2 },
    });
    await guestCartHandler(
      addGuestCart.req as unknown as NextApiRequest,
      addGuestCart.res as unknown as NextApiResponse,
    );
    expect(addGuestCart.res._getStatusCode()).toBe(200);

    const createOrder = createMocks({
      method: 'POST',
      url: '/api/guest/order',
      cookies: { GUEST_SESSION_ID: guestSessionId },
      body: {
        userName: 'Guest Cancel',
        deliveryAddress: 'Guest cancel street',
        deliveryPhone: '+7111',
      },
    });
    await guestOrderHandler(
      createOrder.req as unknown as NextApiRequest,
      createOrder.res as unknown as NextApiResponse,
    );
    const createdOrder = JSON.parse(createOrder.res._getData() as string).data;
    const guestOrderId = createdOrder.id as string;

    const cancel = createMocks({
      method: 'PUT',
      url: `/api/guest/order/${guestOrderId}?action=cancel`,
      query: { id: guestOrderId, action: 'cancel' },
      cookies: { GUEST_SESSION_ID: guestSessionId },
      body: { cancellationReason: 'changed mind' },
    });
    await guestOrderDetailHandler(
      cancel.req as unknown as NextApiRequest,
      cancel.res as unknown as NextApiResponse,
    );
    expect(cancel.res._getStatusCode()).toBe(200);
    expect(JSON.parse(cancel.res._getData() as string).data.status).toBe(
      'USER_CANCELLED',
    );

    const foreignCancel = createMocks({
      method: 'PUT',
      url: `/api/guest/order/${guestOrderId}?action=cancel`,
      query: { id: guestOrderId, action: 'cancel' },
      cookies: { GUEST_SESSION_ID: 'some-other-guest-session' },
      body: { cancellationReason: 'malicious' },
    });
    await guestOrderDetailHandler(
      foreignCancel.req as unknown as NextApiRequest,
      foreignCancel.res as unknown as NextApiResponse,
    );
    expect(foreignCancel.res._getStatusCode()).toBe(400);
    expect(
      JSON.parse(foreignCancel.res._getData() as string).message,
    ).toContain('Unauthorized');
  });

  it('migrates guest cart and guest orders to authenticated user', async () => {
    const guestCartHandler = (await import('@/pages/api/guest/cart.page'))
      .default;
    const guestOrderHandler = (
      await import('@/pages/api/guest/order/index.page')
    ).default;
    const migrateHandler = (await import('@/pages/api/guest/migrate.page'))
      .default;
    const cartHandler = (await import('@/pages/api/cart.page')).default;

    const session = await signupTestUser('guest-migrate');

    const addGuestCart = createMocks({
      method: 'POST',
      url: '/api/guest/cart',
      cookies: { GUEST_SESSION_ID: guestSessionId },
      body: { productId, quantity: 3 },
    });
    await guestCartHandler(
      addGuestCart.req as unknown as NextApiRequest,
      addGuestCart.res as unknown as NextApiResponse,
    );
    expect(addGuestCart.res._getStatusCode()).toBe(200);

    const addUserCart = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: { productId, quantity: 9 },
    });
    await cartHandler(
      addUserCart.req as unknown as NextApiRequest,
      addUserCart.res as unknown as NextApiResponse,
    );
    expect(addUserCart.res._getStatusCode()).toBe(200);

    const addGuestOrder = createMocks({
      method: 'POST',
      url: '/api/guest/order',
      cookies: { GUEST_SESSION_ID: guestSessionId },
      body: {
        userName: 'Guest Before Login',
        deliveryAddress: 'Guest before login',
        deliveryPhone: '+7999',
      },
    });
    await guestOrderHandler(
      addGuestOrder.req as unknown as NextApiRequest,
      addGuestOrder.res as unknown as NextApiResponse,
    );
    expect(addGuestOrder.res._getStatusCode()).toBe(200);

    const addGuestCartAgain = createMocks({
      method: 'POST',
      url: '/api/guest/cart',
      cookies: { GUEST_SESSION_ID: guestSessionId },
      body: { productId, quantity: 4 },
    });
    await guestCartHandler(
      addGuestCartAgain.req as unknown as NextApiRequest,
      addGuestCartAgain.res as unknown as NextApiResponse,
    );
    expect(addGuestCartAgain.res._getStatusCode()).toBe(200);

    const migrate = createMocks({
      method: 'POST',
      url: '/api/guest/migrate',
      headers: { authorization: `Bearer ${session.accessToken}` },
      cookies: { GUEST_SESSION_ID: guestSessionId },
    });
    await migrateHandler(
      migrate.req as unknown as NextApiRequest,
      migrate.res as unknown as NextApiResponse,
    );
    expect(migrate.res._getStatusCode()).toBe(200);
    expect(JSON.parse(migrate.res._getData() as string).data.migrated).toBe(
      true,
    );

    const userCart = await prisma.cartItem.findFirst({
      where: {
        userId: session.userId,
        productId,
      },
    });
    expect(userCart?.quantity).toBe(4);

    const userOrders = await prisma.userOrder.findMany({
      where: {
        userId: session.userId,
        guestSessionId,
      },
    });
    expect(userOrders.length).toBeGreaterThan(0);

    const guestCartLeft = await prisma.guestCartItem.findMany({
      where: { guestSessionId },
    });
    expect(guestCartLeft.length).toBe(0);
  });
});
