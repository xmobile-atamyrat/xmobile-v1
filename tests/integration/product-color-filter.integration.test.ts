import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Product color filter (integration)', () => {
  let prisma: PrismaClient;
  let categoryId: string;
  let colorAId: string;
  let colorBId: string;
  let productAId: string;
  let productBId: string;
  let productCId: string;

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    categoryId = catalog.categoryId;

    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();

    const colorA = await prisma.color.create({
      data: { name: 'FilterTest ColorA', hex: '#aaaaff' },
    });
    colorAId = colorA.id;

    const colorB = await prisma.color.create({
      data: { name: 'FilterTest ColorB', hex: '#ffaaaa' },
    });
    colorBId = colorB.id;

    const pA = await prisma.product.create({
      data: {
        slug: 'filter-test-product-a',
        name: '{"en":"Filter Product A"}',
        categoryId,
        imgUrls: [],
        videoUrls: [],
        tags: [`128gb [stub]{${colorAId}}`],
        colors: { connect: [{ id: colorAId }] },
      },
    });
    productAId = pA.id;

    const pB = await prisma.product.create({
      data: {
        slug: 'filter-test-product-b',
        name: '{"en":"Filter Product B"}',
        categoryId,
        imgUrls: [],
        videoUrls: [],
        tags: [`64gb [stub]{${colorBId}}`],
        colors: { connect: [{ id: colorBId }] },
      },
    });
    productBId = pB.id;

    const pC = await prisma.product.create({
      data: {
        slug: 'filter-test-product-c',
        name: '{"en":"Filter Product C (no color)"}',
        categoryId,
        imgUrls: [],
        videoUrls: [],
        tags: [],
      },
    });
    productCId = pC.id;
  }, 180_000);

  afterAll(async () => {
    for (const id of [productAId, productBId, productCId]) {
      await prisma.product.delete({ where: { id } }).catch(() => {});
    }
    await prisma.color.deleteMany({
      where: { name: { startsWith: 'FilterTest' } },
    });
    await prisma.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('GET /api/product?colorIds returns only products linked to that color', async () => {
    const handler = (await import('@/pages/api/product/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/product',
      query: { colorIds: colorAId },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData() as string);
    const ids = (body.data?.products ?? body.data ?? []).map(
      (p: { id: string }) => p.id,
    );
    expect(ids).toContain(productAId);
    expect(ids).not.toContain(productBId);
    expect(ids).not.toContain(productCId);
  });

  it('GET /api/product?colorIds with two colors returns both matching products (OR logic)', async () => {
    const handler = (await import('@/pages/api/product/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/product',
      query: { colorIds: [colorAId, colorBId] },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData() as string);
    const ids = (body.data?.products ?? body.data ?? []).map(
      (p: { id: string }) => p.id,
    );
    expect(ids).toContain(productAId);
    expect(ids).toContain(productBId);
  });

  it('product without any color does not appear in colorIds filter results', async () => {
    const handler = (await import('@/pages/api/product/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/product',
      query: { colorIds: colorAId },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    const body = JSON.parse(res._getData() as string);
    const ids = (body.data?.products ?? body.data ?? []).map(
      (p: { id: string }) => p.id,
    );
    expect(ids).not.toContain(productCId);
  });

  it('GET /api/product/filters returns color IDs in use', async () => {
    const filtersHandler = (await import('@/pages/api/product/filters.page'))
      .default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/product/filters',
    });
    await filtersHandler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData() as string);
    expect(body.success).toBe(true);
    expect(body.data.colors).toContain(colorAId);
    expect(body.data.colors).toContain(colorBId);
  });

  it('GET /api/product/filters returns 405 for non-GET requests', async () => {
    const filtersHandler = (await import('@/pages/api/product/filters.page'))
      .default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/product/filters',
    });
    await filtersHandler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(405);
  });
});
