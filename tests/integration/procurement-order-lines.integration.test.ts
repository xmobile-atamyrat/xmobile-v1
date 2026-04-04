import type { NextApiRequest, NextApiResponse } from 'next';
import { CURRENCY, PrismaClient, UserRole } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Procurement order prices & quantities API (integration)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();
    await prisma.dollarRate.upsert({
      where: { currency: CURRENCY.TMT },
      create: { currency: CURRENCY.TMT, rate: 1, name: 'Manat' },
      update: { rate: 1 },
    });
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('returns 401 for non-superuser', async () => {
    const free = await signupTestUser('proc-pq-free');
    const prices = (await import('@/pages/api/procurement/order/prices.page'))
      .default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/procurement/order/prices',
      headers: { authorization: `Bearer ${free.accessToken}` },
      query: { id: 'any' },
    });
    await prices(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(401);
  });

  it('SUPERUSER GET prices and quantities for an order (empty lists)', async () => {
    const su = await createStaffPrincipal(prisma, UserRole.SUPERUSER);
    const orderHandler = (
      await import('@/pages/api/procurement/order/index.page')
    ).default;
    const post = createMocks({
      method: 'POST',
      url: '/api/procurement/order',
      headers: { authorization: `Bearer ${su.accessToken}` },
      body: { name: `Lines-${Date.now()}` },
    });
    await orderHandler(
      post.req as unknown as NextApiRequest,
      post.res as unknown as NextApiResponse,
    );
    const orderId = JSON.parse(post.res._getData() as string).data.id as string;

    const prices = (await import('@/pages/api/procurement/order/prices.page'))
      .default;
    const pq = createMocks({
      method: 'GET',
      url: '/api/procurement/order/prices',
      headers: { authorization: `Bearer ${su.accessToken}` },
      query: { id: orderId },
    });
    await prices(
      pq.req as unknown as NextApiRequest,
      pq.res as unknown as NextApiResponse,
    );
    expect(pq.res._getStatusCode()).toBe(200);
    expect(JSON.parse(pq.res._getData() as string).data).toEqual([]);

    const quantities = (
      await import('@/pages/api/procurement/order/quantities.page')
    ).default;
    const qq = createMocks({
      method: 'GET',
      url: '/api/procurement/order/quantities',
      headers: { authorization: `Bearer ${su.accessToken}` },
      query: { id: orderId },
    });
    await quantities(
      qq.req as unknown as NextApiRequest,
      qq.res as unknown as NextApiResponse,
    );
    expect(qq.res._getStatusCode()).toBe(200);
    expect(JSON.parse(qq.res._getData() as string).data).toEqual([]);

    const del = createMocks({
      method: 'DELETE',
      url: '/api/procurement/order',
      headers: { authorization: `Bearer ${su.accessToken}` },
      body: { id: orderId },
    });
    await orderHandler(
      del.req as unknown as NextApiRequest,
      del.res as unknown as NextApiResponse,
    );
    await prisma.user.delete({ where: { id: su.userId } });
  });
});
