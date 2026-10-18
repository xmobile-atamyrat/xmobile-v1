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

describe('Cart API (integration)', () => {
  let prisma: PrismaClient;
  let productId: string;
  let categoryId: string;

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    productId = catalog.productId;
    categoryId = catalog.categoryId;

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

  it('returns 401 when Authorization is missing', async () => {
    const cartHandler = (await import('@/pages/api/cart.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/cart',
    });
    await cartHandler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(401);
  });

  it('POST adds line, rejects duplicate, GET lists, PUT updates qty, DELETE removes', async () => {
    const session = await signupTestUser('cart-flow');
    const cartHandler = (await import('@/pages/api/cart.page')).default;
    const auth = { authorization: `Bearer ${session.accessToken}` };

    const add = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: auth,
      body: { productId, quantity: 2 },
    });
    await cartHandler(
      add.req as unknown as NextApiRequest,
      add.res as unknown as NextApiResponse,
    );
    expect(add.res._getStatusCode()).toBe(200);

    const dup = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: auth,
      body: { productId, quantity: 1 },
    });
    await cartHandler(
      dup.req as unknown as NextApiRequest,
      dup.res as unknown as NextApiResponse,
    );
    expect(dup.res._getStatusCode()).toBe(400);
    expect(JSON.parse(dup.res._getData() as string).message).toBe(
      'cartItemExistError',
    );

    const get = createMocks({
      method: 'GET',
      url: '/api/cart',
      headers: auth,
    });
    await cartHandler(
      get.req as unknown as NextApiRequest,
      get.res as unknown as NextApiResponse,
    );
    expect(get.res._getStatusCode()).toBe(200);
    const items = JSON.parse(get.res._getData() as string).data;
    expect(items.length).toBe(1);
    const cartItemId = items[0].id;

    const put = createMocks({
      method: 'PUT',
      url: '/api/cart',
      headers: auth,
      body: { id: cartItemId, quantity: 7 },
    });
    await cartHandler(
      put.req as unknown as NextApiRequest,
      put.res as unknown as NextApiResponse,
    );
    expect(put.res._getStatusCode()).toBe(200);
    expect(JSON.parse(put.res._getData() as string).data.quantity).toBe(7);

    const del = createMocks({
      method: 'DELETE',
      url: '/api/cart',
      headers: auth,
      body: { id: cartItemId },
    });
    await cartHandler(
      del.req as unknown as NextApiRequest,
      del.res as unknown as NextApiResponse,
    );
    expect(del.res._getStatusCode()).toBe(200);

    const empty = createMocks({
      method: 'GET',
      url: '/api/cart',
      headers: auth,
    });
    await cartHandler(
      empty.req as unknown as NextApiRequest,
      empty.res as unknown as NextApiResponse,
    );
    expect(JSON.parse(empty.res._getData() as string).data.length).toBe(0);
  });

  it('PUT rejects quantities outside 1..999 and returns 404 for an unknown item', async () => {
    const session = await signupTestUser('cart-put-guard');
    const cartHandler = (await import('@/pages/api/cart.page')).default;
    const auth = { authorization: `Bearer ${session.accessToken}` };
    const item = await prisma.cartItem.create({
      data: { userId: session.userId, productId, quantity: 2 },
    });

    const putQuantity = async (id: string, quantity: number) => {
      const { req, res } = createMocks({
        method: 'PUT',
        url: '/api/cart',
        headers: auth,
        body: { id, quantity },
      });
      await cartHandler(
        req as unknown as NextApiRequest,
        res as unknown as NextApiResponse,
      );
      return res._getStatusCode();
    };

    expect(await putQuantity(item.id, 0)).toBe(400);
    expect(await putQuantity(item.id, 1000)).toBe(400);
    expect(await putQuantity('00000000-0000-4000-8000-000000000002', 3)).toBe(
      404,
    );
    expect(
      (await prisma.cartItem.findUnique({ where: { id: item.id } }))?.quantity,
    ).toBe(2);

    await prisma.cartItem.delete({ where: { id: item.id } });
  });

  it('GET hides lines saved with a quantity below 1', async () => {
    const session = await signupTestUser('cart-zero-row');
    const cartHandler = (await import('@/pages/api/cart.page')).default;
    const auth = { authorization: `Bearer ${session.accessToken}` };
    await prisma.cartItem.create({
      data: { userId: session.userId, productId, quantity: 0 },
    });

    const list = createMocks({
      method: 'GET',
      url: '/api/cart',
      headers: auth,
    });
    await cartHandler(
      list.req as unknown as NextApiRequest,
      list.res as unknown as NextApiResponse,
    );
    expect(JSON.parse(list.res._getData() as string).data).toEqual([]);

    const count = createMocks({
      method: 'GET',
      url: '/api/cart',
      headers: auth,
      query: { count: '1' },
    });
    await cartHandler(
      count.req as unknown as NextApiRequest,
      count.res as unknown as NextApiResponse,
    );
    expect(JSON.parse(count.res._getData() as string).data.count).toBe(0);

    // Adding the product again revives the hidden line rather than failing
    // with cartItemExistError.
    const add = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: auth,
      body: { productId, quantity: 3 },
    });
    await cartHandler(
      add.req as unknown as NextApiRequest,
      add.res as unknown as NextApiResponse,
    );
    expect(add.res._getStatusCode()).toBe(200);
    const lines = await prisma.cartItem.findMany({
      where: { userId: session.userId },
    });
    expect(lines.map((line) => line.quantity)).toEqual([3]);

    await prisma.cartItem.deleteMany({ where: { userId: session.userId } });
  });

  it('POST returns 404 for unknown product id', async () => {
    const session = await signupTestUser('cart-404');
    const cartHandler = (await import('@/pages/api/cart.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: {
        productId: '00000000-0000-4000-8000-000000000001',
        quantity: 1,
      },
    });
    await cartHandler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(404);
    expect(JSON.parse(res._getData() as string).message).toBe(
      'Product not found',
    );
  });

  it('POST returns 404 when product is soft-deleted', async () => {
    const session = await signupTestUser('cart-deleted');
    const dead = await prisma.product.create({
      data: {
        name: '{"en":"Soon gone"}',
        slug: 'soon-gone',
        categoryId,
        imgUrls: [],
        tags: [],
        videoUrls: [],
        deletedAt: new Date(),
      },
    });

    const cartHandler = (await import('@/pages/api/cart.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: { productId: dead.id, quantity: 1 },
    });
    await cartHandler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(404);

    await prisma.product.delete({ where: { id: dead.id } });
  });

  it('returns 405 for unsupported method', async () => {
    const session = await signupTestUser('cart-405');
    const cartHandler = (await import('@/pages/api/cart.page')).default;
    const { req, res } = createMocks({
      method: 'PATCH',
      url: '/api/cart',
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    await cartHandler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(405);
  });
});
