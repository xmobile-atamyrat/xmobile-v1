import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Order checkout flow (integration)', () => {
  let productId: string;

  beforeAll(async () => {
    const { catalog } = await prepareIntegrationWorker();
    productId = catalog.productId;
  }, 180_000);

  afterAll(async () => {
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('creates order from cart, clears cart, lists order, fetches detail, blocks other user, cancels', async () => {
    const session = await signupTestUser('buyer');
    const accessToken = session.accessToken;
    const userId = session.userId;

    const cartHandler = (await import('@/pages/api/cart.page')).default;
    const add = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: { authorization: `Bearer ${accessToken}` },
      body: { productId, quantity: 3 },
    });
    await cartHandler(
      add.req as unknown as NextApiRequest,
      add.res as unknown as NextApiResponse,
    );
    expect(add.res._getStatusCode()).toBe(200);

    const orderHandler = (await import('@/pages/api/order/index.page')).default;
    const postOrder = createMocks({
      method: 'POST',
      url: '/api/order',
      headers: { authorization: `Bearer ${accessToken}` },
      body: {
        deliveryAddress: '1 Test Street',
        deliveryPhone: '+777',
        notes: 'Integration',
        updateAddress: true,
      },
    });
    await orderHandler(
      postOrder.req as unknown as NextApiRequest,
      postOrder.res as unknown as NextApiResponse,
    );
    expect(postOrder.res._getStatusCode()).toBe(200);
    const orderJson = JSON.parse(postOrder.res._getData() as string);
    expect(orderJson.data.orderNumber).toMatch(/^ORD-\d{8}-\d{3}$/);
    const orderId = orderJson.data.id;

    const empty = createMocks({
      method: 'GET',
      url: '/api/cart',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    await cartHandler(
      empty.req as unknown as NextApiRequest,
      empty.res as unknown as NextApiResponse,
    );
    expect(JSON.parse(empty.res._getData() as string).data.length).toBe(0);

    const list = createMocks({
      method: 'GET',
      url: '/api/order',
      headers: { authorization: `Bearer ${accessToken}` },
      query: {},
    });
    await orderHandler(
      list.req as unknown as NextApiRequest,
      list.res as unknown as NextApiResponse,
    );
    expect(list.res._getStatusCode()).toBe(200);
    const listJson = JSON.parse(list.res._getData() as string);
    expect(
      listJson.data.orders.some((o: { id: string }) => o.id === orderId),
    ).toBe(true);
    expect(listJson.data.pagination.page).toBe(1);

    const detail = (await import('@/pages/api/order/[id].page')).default;
    const own = createMocks({
      method: 'GET',
      url: '/api/order/x',
      headers: { authorization: `Bearer ${accessToken}` },
      query: { id: orderId },
    });
    await detail(
      own.req as unknown as NextApiRequest,
      own.res as unknown as NextApiResponse,
    );
    expect(own.res._getStatusCode()).toBe(200);
    expect(JSON.parse(own.res._getData() as string).data.id).toBe(orderId);

    const other = await signupTestUser('other');
    const foreign = createMocks({
      method: 'GET',
      url: '/api/order/x',
      headers: { authorization: `Bearer ${other.accessToken}` },
      query: { id: orderId },
    });
    await detail(
      foreign.req as unknown as NextApiRequest,
      foreign.res as unknown as NextApiResponse,
    );
    expect(foreign.res._getStatusCode()).toBe(403);

    const cancel = createMocks({
      method: 'PUT',
      url: '/api/order/x',
      headers: { authorization: `Bearer ${accessToken}` },
      query: { id: orderId, action: 'cancel' },
      body: { cancellationReason: 'changed mind' },
    });
    await detail(
      cancel.req as unknown as NextApiRequest,
      cancel.res as unknown as NextApiResponse,
    );
    expect(cancel.res._getStatusCode()).toBe(200);
    expect(JSON.parse(cancel.res._getData() as string).data.status).toBe(
      'USER_CANCELLED',
    );

    expect(userId).toBeTruthy();
  });
});
