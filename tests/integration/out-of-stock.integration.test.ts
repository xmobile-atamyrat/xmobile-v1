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
        isOutOfStock: false,
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
        isOutOfStock: true,
      },
    });
    outOfStockProductId = outOfStock.id;
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('GET /api/product?productId returns isOutOfStock: true for an out-of-stock product', async () => {
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
    expect(json.data.isOutOfStock).toBe(true);
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
      isOutOfStock: boolean;
    }[];

    const inStockIdx = products.findIndex((p) => p.id === inStockProductId);
    const outOfStockIdx = products.findIndex(
      (p) => p.id === outOfStockProductId,
    );

    expect(inStockIdx).toBeGreaterThanOrEqual(0);
    expect(outOfStockIdx).toBeGreaterThanOrEqual(0);
    expect(inStockIdx).toBeLessThan(outOfStockIdx);
  });
});
