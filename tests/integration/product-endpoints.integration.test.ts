import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Product utility endpoints (integration)', () => {
  let productId: string;

  beforeAll(async () => {
    const { catalog } = await prepareIntegrationWorker();
    productId = catalog.productId;
  }, 180_000);

  afterAll(async () => {
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('GET /api/product/slugs returns all active product slugs including seed', async () => {
    const handler = (await import('@/pages/api/product/slugs.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/product/slugs',
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const slugs = JSON.parse(res._getData() as string).data as string[];
    expect(slugs).toContain(productId);
  });

  it('GET /api/product/slugs returns 405 for POST', async () => {
    const handler = (await import('@/pages/api/product/slugs.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/product/ids',
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(405);
  });

  it('GET /api/product/new returns seeded product on page 1', async () => {
    const handler = (await import('@/pages/api/product/new.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/product/new',
      query: { page: '1' },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const rows = JSON.parse(res._getData() as string).data as { id: string }[];
    expect(rows.some((p) => p.id === productId)).toBe(true);
  });

  it('GET /api/product/new returns 405 for POST', async () => {
    const handler = (await import('@/pages/api/product/new.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/product/new',
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(405);
  });
});
