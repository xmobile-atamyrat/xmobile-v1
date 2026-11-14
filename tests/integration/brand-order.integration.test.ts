import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createStaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Brand order (integration)', () => {
  let prisma: PrismaClient;
  let adminToken: string;
  let freeToken: string;

  const call = async (
    token: string | null,
    options: Parameters<typeof createMocks>[0],
  ) => {
    const handler = (await import('@/pages/api/brand/index.page')).default;
    const { req, res } = createMocks({
      url: '/api/brand',
      ...options,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    return { status: res._getStatusCode(), body: JSON.parse(res._getData()) };
  };

  const orderedIds = async () =>
    (
      await prisma.brand.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true },
      })
    ).map(({ id }) => id);

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    adminToken = (await createStaffPrincipal(prisma, 'ADMIN')).accessToken;
    freeToken = (await createStaffPrincipal(prisma, 'FREE')).accessToken;

    for (const name of ['BrandOrder A', 'BrandOrder B']) {
      // eslint-disable-next-line no-await-in-loop
      const created = await call(adminToken, {
        method: 'POST',
        body: { name },
      });
      expect(created.status).toBe(201);
    }
  }, 180_000);

  afterAll(async () => {
    await prisma.brand
      .deleteMany({ where: { name: { startsWith: 'BrandOrder' } } })
      .catch(() => {});
    await prisma.$disconnect();
    teardownIntegrationWorker();
  });

  it('adds a new brand at the end', async () => {
    const ids = await orderedIds();
    const last = await prisma.brand.findUniqueOrThrow({
      where: { id: ids[ids.length - 1] },
    });
    expect(last.name).toBe('BrandOrder B');
  });

  it('saves the order and lists brands in it', async () => {
    const reversed = (await orderedIds()).reverse();

    const saved = await call(adminToken, {
      method: 'PATCH',
      body: { order: reversed },
    });
    expect(saved.status).toBe(200);

    const listed = await call(null, { method: 'GET' });
    expect(listed.body.data.map(({ id }: { id: string }) => id)).toEqual(
      reversed,
    );
  });

  it('rejects a list that is missing a brand', async () => {
    const before = await orderedIds();

    const stale = await call(adminToken, {
      method: 'PATCH',
      body: { order: before.slice(1).reverse() },
    });
    expect(stale.status).toBe(409);
    expect(stale.body.message).toBe('brandOrderStale');
    expect(await orderedIds()).toEqual(before);
  });

  it('rejects a list with a duplicate', async () => {
    const before = await orderedIds();

    const duplicated = await call(adminToken, {
      method: 'PATCH',
      body: { order: [before[0], ...before.slice(0, -1)] },
    });
    expect(duplicated.status).toBe(409);
  });

  it('refuses shoppers', async () => {
    const res = await call(freeToken, {
      method: 'PATCH',
      body: { order: await orderedIds() },
    });
    expect(res.status).toBe(401);
  });
});
