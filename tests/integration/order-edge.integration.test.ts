import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'node:crypto';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Order API edge cases (integration)', () => {
  beforeAll(async () => {
    await prepareIntegrationWorker();
  }, 180_000);

  afterAll(async () => {
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('GET /api/order without auth returns 401', async () => {
    const orderHandler = (await import('@/pages/api/order/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/order',
      query: {},
    });
    await orderHandler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(401);
  });

  it('GET /api/order returns 405 for unsupported method', async () => {
    const session = await signupTestUser('order-method');
    const orderHandler = (await import('@/pages/api/order/index.page')).default;
    const { req, res } = createMocks({
      method: 'PATCH',
      url: '/api/order',
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    await orderHandler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(405);
  });

  it('GET /api/order/[id] returns 404 for unknown order id', async () => {
    const session = await signupTestUser('order-404');
    const detail = (await import('@/pages/api/order/[id].page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/order/x',
      headers: { authorization: `Bearer ${session.accessToken}` },
      query: { id: randomUUID() },
    });
    await detail(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(404);
  });

  it('GET /api/order/[id] returns 400 when id query missing', async () => {
    const session = await signupTestUser('order-noid');
    const detail = (await import('@/pages/api/order/[id].page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/order/x',
      headers: { authorization: `Bearer ${session.accessToken}` },
      query: {},
    });
    await detail(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(400);
  });

  it('PUT /api/order/[id] without cancel action returns 400', async () => {
    const session = await signupTestUser('order-bad-put');
    const detail = (await import('@/pages/api/order/[id].page')).default;
    const { req, res } = createMocks({
      method: 'PUT',
      url: '/api/order/x',
      headers: { authorization: `Bearer ${session.accessToken}` },
      query: { id: randomUUID() },
      body: {},
    });
    await detail(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData() as string).message).toContain('cancel');
  });
});
