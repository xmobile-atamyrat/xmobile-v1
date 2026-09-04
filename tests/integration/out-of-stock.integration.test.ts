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

describe('Out-of-stock product API (integration)', () => {
  let prisma: PrismaClient;
  let categoryId: string;
  let inStockProductId: string;
  let outOfStockProductId: string;

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    categoryId = catalog.categoryId;

    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();

    const price = await prisma.prices.create({
      data: { name: 'oos-price', price: '1', priceInTmt: '10.00' },
    });
    const priceRef = `[${price.id}]`;

    const inStock = await prisma.product.create({
      data: {
        slug: `oos-in-stock-${Date.now()}`,
        name: '{"en":"In Stock","tk":"In Stock","ru":"In Stock","ch":"In Stock"}',
        categoryId,
        imgUrls: [],
        tags: [],
        videoUrls: [],
        price: priceRef,
        outOfStockAt: null,
      },
    });
    inStockProductId = inStock.id;

    const outOfStock = await prisma.product.create({
      data: {
        slug: `oos-out-${Date.now()}`,
        name: '{"en":"Out Of Stock","tk":"Out Of Stock","ru":"Out Of Stock","ch":"Out Of Stock"}',
        categoryId,
        imgUrls: [],
        tags: [],
        videoUrls: [],
        price: priceRef,
        outOfStockAt: new Date(),
      },
    });
    outOfStockProductId = outOfStock.id;
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('GET /api/product?productId returns outOfStockAt for an out-of-stock product', async () => {
    const session = await signupTestUser('oos-get');
    const handler = (await import('@/pages/api/product/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/product',
      query: { productId: outOfStockProductId },
      headers: { authorization: `Bearer ${session.accessToken}` },
    });

    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );

    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.success).toBe(true);
    expect(json.data.outOfStockAt).not.toBeNull();
  });

  it('GET /api/product?categoryId lists in-stock products before out-of-stock ones', async () => {
    const session = await signupTestUser('oos-sort');
    const handler = (await import('@/pages/api/product/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/product',
      query: { categoryId, page: '1' },
      headers: { authorization: `Bearer ${session.accessToken}` },
    });

    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );

    expect(res._getStatusCode()).toBe(200);
    const products = JSON.parse(res._getData() as string).data as {
      id: string;
      outOfStockAt: string | null;
    }[];

    const inStockIdx = products.findIndex((p) => p.id === inStockProductId);
    const outOfStockIdx = products.findIndex(
      (p) => p.id === outOfStockProductId,
    );

    expect(inStockIdx).toBeGreaterThanOrEqual(0);
    expect(outOfStockIdx).toBeGreaterThanOrEqual(0);
    expect(inStockIdx).toBeLessThan(outOfStockIdx);
  });

  it('POST /api/order is rejected when the cart holds an out-of-stock product', async () => {
    const session = await signupTestUser('oos-order-block');
    await prisma.cartItem.create({
      data: {
        userId: session.userId,
        productId: outOfStockProductId,
        quantity: 1,
      },
    });

    const handler = (await import('@/pages/api/order/index.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/order',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: {
        deliveryAddress: 'Blocked street 1',
        deliveryPhone: '+99312000000',
      },
    });

    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );

    const json = JSON.parse(res._getData() as string);
    expect(json.success).toBe(false);
    expect(json.message).toBe('OUT_OF_STOCK_ITEMS');

    // No order created, and the cart is left untouched for the user to fix
    const orders = await prisma.userOrder.findMany({
      where: { userId: session.userId },
    });
    expect(orders.length).toBe(0);

    const remainingCart = await prisma.cartItem.findMany({
      where: { userId: session.userId },
    });
    expect(remainingCart.length).toBe(1);
  });

  it('POST /api/order succeeds once only in-stock products remain', async () => {
    const session = await signupTestUser('oos-order-allow');
    await prisma.cartItem.create({
      data: {
        userId: session.userId,
        productId: inStockProductId,
        quantity: 1,
      },
    });

    const handler = (await import('@/pages/api/order/index.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/order',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: {
        deliveryAddress: 'Allowed street 1',
        deliveryPhone: '+99312000001',
      },
    });

    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData() as string).success).toBe(true);

    const orders = await prisma.userOrder.findMany({
      where: { userId: session.userId },
    });
    expect(orders.length).toBe(1);
  });

  it('POST /api/guest/order is rejected when the guest cart holds an out-of-stock product', async () => {
    const guestSessionId = `oos-guest-${Date.now()}`;
    await prisma.guestCartItem.create({
      data: {
        guestSessionId,
        productId: outOfStockProductId,
        quantity: 1,
      },
    });

    const handler = (await import('@/pages/api/guest/order/index.page'))
      .default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/guest/order',
      cookies: { GUEST_SESSION_ID: guestSessionId },
      body: {
        userName: 'Blocked Guest',
        deliveryAddress: 'Guest blocked street',
        deliveryPhone: '+99312000002',
      },
    });

    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );

    const json = JSON.parse(res._getData() as string);
    expect(json.success).toBe(false);
    expect(json.message).toBe('OUT_OF_STOCK_ITEMS');

    const remainingCart = await prisma.guestCartItem.findMany({
      where: { guestSessionId },
    });
    expect(remainingCart.length).toBe(1);
  });
});
