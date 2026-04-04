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

describe('Procurement API (integration, SUPERUSER)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();
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

  it('returns 401 for non-superuser on supplier list', async () => {
    const free = await signupTestUser('proc-free');
    const handler = (await import('@/pages/api/procurement/supplier.page'))
      .default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/procurement/supplier',
      headers: { authorization: `Bearer ${free.accessToken}` },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(401);
  });

  it('SUPERUSER CRUD suppliers', async () => {
    const su = await createStaffPrincipal(prisma, UserRole.SUPERUSER);
    const handler = (await import('@/pages/api/procurement/supplier.page'))
      .default;
    const auth = { authorization: `Bearer ${su.accessToken}` };
    const name = `Sup-${Date.now()}`;

    const post = createMocks({
      method: 'POST',
      url: '/api/procurement/supplier',
      headers: auth,
      body: { name, description: 'd' },
    });
    await handler(
      post.req as unknown as NextApiRequest,
      post.res as unknown as NextApiResponse,
    );
    expect(post.res._getStatusCode()).toBe(200);
    const row = JSON.parse(post.res._getData() as string).data as {
      id: string;
    };

    const put = createMocks({
      method: 'PUT',
      url: '/api/procurement/supplier',
      headers: auth,
      body: { id: row.id, name: `${name}-2`, description: 'd2' },
    });
    await handler(
      put.req as unknown as NextApiRequest,
      put.res as unknown as NextApiResponse,
    );
    expect(put.res._getStatusCode()).toBe(200);

    const del = createMocks({
      method: 'DELETE',
      url: '/api/procurement/supplier',
      headers: auth,
      body: { id: row.id },
    });
    await handler(
      del.req as unknown as NextApiRequest,
      del.res as unknown as NextApiResponse,
    );
    expect(del.res._getStatusCode()).toBe(200);

    await prisma.user.delete({ where: { id: su.userId } });
  });

  it('SUPERUSER CRUD procurement products', async () => {
    const su = await createStaffPrincipal(prisma, UserRole.SUPERUSER);
    const handler = (await import('@/pages/api/procurement/product.page'))
      .default;
    const auth = { authorization: `Bearer ${su.accessToken}` };
    const name = `Pp-${Date.now()}`;

    const post = createMocks({
      method: 'POST',
      url: '/api/procurement/product',
      headers: auth,
      body: { name },
    });
    await handler(
      post.req as unknown as NextApiRequest,
      post.res as unknown as NextApiResponse,
    );
    expect(post.res._getStatusCode()).toBe(200);
    const row = JSON.parse(post.res._getData() as string).data as {
      id: string;
    };

    const del = createMocks({
      method: 'DELETE',
      url: '/api/procurement/product',
      headers: auth,
      body: { id: row.id },
    });
    await handler(
      del.req as unknown as NextApiRequest,
      del.res as unknown as NextApiResponse,
    );
    expect(del.res._getStatusCode()).toBe(200);

    await prisma.user.delete({ where: { id: su.userId } });
  });

  it('SUPERUSER creates procurement order and lists it', async () => {
    await prisma.dollarRate.upsert({
      where: { currency: CURRENCY.TMT },
      create: { currency: CURRENCY.TMT, rate: 1, name: 'Manat' },
      update: { rate: 1 },
    });

    const su = await createStaffPrincipal(prisma, UserRole.SUPERUSER);
    const handler = (await import('@/pages/api/procurement/order/index.page'))
      .default;
    const auth = { authorization: `Bearer ${su.accessToken}` };
    const oname = `Po-${Date.now()}`;

    const post = createMocks({
      method: 'POST',
      url: '/api/procurement/order',
      headers: auth,
      body: { name: oname },
    });
    await handler(
      post.req as unknown as NextApiRequest,
      post.res as unknown as NextApiResponse,
    );
    expect(post.res._getStatusCode()).toBe(200);
    const order = JSON.parse(post.res._getData() as string).data as {
      id: string;
    };

    const list = createMocks({
      method: 'GET',
      url: '/api/procurement/order',
      headers: auth,
      query: {},
    });
    await handler(
      list.req as unknown as NextApiRequest,
      list.res as unknown as NextApiResponse,
    );
    expect(list.res._getStatusCode()).toBe(200);
    const all = JSON.parse(list.res._getData() as string).data as {
      id: string;
    }[];
    expect(all.some((o) => o.id === order.id)).toBe(true);

    const del = createMocks({
      method: 'DELETE',
      url: '/api/procurement/order',
      headers: auth,
      body: { id: order.id },
    });
    await handler(
      del.req as unknown as NextApiRequest,
      del.res as unknown as NextApiResponse,
    );
    expect(del.res._getStatusCode()).toBe(200);

    await prisma.user.delete({ where: { id: su.userId } });
  });
});
