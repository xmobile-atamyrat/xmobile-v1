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
import { parseOrderVariant } from '@/pages/product/utils';

describe('Order — variant snapshots (integration)', () => {
  let prisma: PrismaClient;
  let productId: string;
  let priceId: string;
  let colorId: string;

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    productId = catalog.productId;
    priceId = catalog.priceId;

    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();

    const color = await prisma.color.create({
      data: { name: 'OrderTest Red', hex: '#ff0000' },
    });
    colorId = color.id;
  }, 180_000);

  afterAll(async () => {
    await prisma.color
      .delete({ where: { name: 'OrderTest Red' } })
      .catch(() => {});
    await prisma.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('creates an order with a variant and snapshots spec + colorHex + colorName as JSON', async () => {
    const session = await signupTestUser('ov-snapshot');
    const auth = { authorization: `Bearer ${session.accessToken}` };
    const selectedVariant = `128gb storage [${priceId}]{${colorId}}`;

    // Add cart item with the variant
    const cartHandler = (await import('@/pages/api/cart.page')).default;
    const add = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: auth,
      body: { productId, quantity: 1, selectedVariant },
    });
    await cartHandler(
      add.req as unknown as NextApiRequest,
      add.res as unknown as NextApiResponse,
    );
    expect(add.res._getStatusCode()).toBe(200);

    // Create order
    const orderHandler = (await import('@/pages/api/order/index.page')).default;
    const postOrder = createMocks({
      method: 'POST',
      url: '/api/order',
      headers: auth,
      body: {
        deliveryAddress: '1 Variant Lane',
        deliveryPhone: '+999',
        notes: 'variant test',
      },
    });
    await orderHandler(
      postOrder.req as unknown as NextApiRequest,
      postOrder.res as unknown as NextApiResponse,
    );
    expect(postOrder.res._getStatusCode()).toBe(200);
    const orderId = JSON.parse(postOrder.res._getData() as string).data.id;

    // Inspect the order item in the DB
    const order = await prisma.userOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    expect(order?.items).toHaveLength(1);

    const rawSnapshot = order!.items[0].selectedVariant;
    expect(rawSnapshot).not.toBeNull();

    const snapshot = parseOrderVariant(rawSnapshot!);
    expect(snapshot.spec).toBe('128gb storage');
    expect(snapshot.colorHex).toBe('#ff0000');
    expect(snapshot.colorName).toBe('OrderTest Red');
  });

  it('order item without a variant stores null selectedVariant', async () => {
    const session = await signupTestUser('ov-no-variant');
    const auth = { authorization: `Bearer ${session.accessToken}` };

    const cartHandler = (await import('@/pages/api/cart.page')).default;
    const add = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: auth,
      body: { productId, quantity: 1 },
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
      headers: auth,
      body: {
        deliveryAddress: '2 Plain Street',
        deliveryPhone: '+998',
      },
    });
    await orderHandler(
      postOrder.req as unknown as NextApiRequest,
      postOrder.res as unknown as NextApiResponse,
    );
    expect(postOrder.res._getStatusCode()).toBe(200);
    const orderId = JSON.parse(postOrder.res._getData() as string).data.id;

    const order = await prisma.userOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    expect(order?.items[0].selectedVariant).toBeNull();
  });

  it('an order created with a variant can still be cancelled', async () => {
    const session = await signupTestUser('ov-cancel');
    const auth = { authorization: `Bearer ${session.accessToken}` };
    const selectedVariant = `64gb [${priceId}]{${colorId}}`;

    const cartHandler = (await import('@/pages/api/cart.page')).default;
    const add = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: auth,
      body: { productId, quantity: 1, selectedVariant },
    });
    await cartHandler(
      add.req as unknown as NextApiRequest,
      add.res as unknown as NextApiResponse,
    );

    const orderHandler = (await import('@/pages/api/order/index.page')).default;
    const postOrder = createMocks({
      method: 'POST',
      url: '/api/order',
      headers: auth,
      body: { deliveryAddress: '3 Cancel Ave', deliveryPhone: '+997' },
    });
    await orderHandler(
      postOrder.req as unknown as NextApiRequest,
      postOrder.res as unknown as NextApiResponse,
    );
    expect(postOrder.res._getStatusCode()).toBe(200);
    const orderId = JSON.parse(postOrder.res._getData() as string).data.id;

    const detailHandler = (await import('@/pages/api/order/[id].page')).default;
    const cancel = createMocks({
      method: 'PUT',
      url: '/api/order/x',
      headers: auth,
      query: { id: orderId, action: 'cancel' },
      body: { cancellationReason: 'test cancel' },
    });
    await detailHandler(
      cancel.req as unknown as NextApiRequest,
      cancel.res as unknown as NextApiResponse,
    );
    expect(cancel.res._getStatusCode()).toBe(200);
    expect(JSON.parse(cancel.res._getData() as string).data.status).toBe(
      'USER_CANCELLED',
    );
  });
});
