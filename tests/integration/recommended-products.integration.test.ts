import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, UserRole } from '@prisma/client';
import { createMocks, RequestMethod } from 'node-mocks-http';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal, StaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Recommended products (integration)', () => {
  let prisma: PrismaClient;
  let admin: StaffPrincipal;
  let categoryId: string;
  let brandId: string;
  const ids: string[] = [];

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    categoryId = catalog.categoryId;
    brandId = catalog.brandId;
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    admin = await createStaffPrincipal(prisma, UserRole.ADMIN);

    // Created oldest first, so `newest` sorting would list them in reverse.
    for (let i = 0; i < 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const product = await prisma.product.create({
        data: {
          slug: `rec-${i}-${Date.now()}`,
          name: JSON.stringify({ en: `Rec ${i}` }),
          categoryId,
          brandId,
          imgUrls: [`/media/rec-${i}.webp`],
          tags: [],
          videoUrls: [],
          createdAt: new Date(Date.UTC(2001, 0, 1 + i)),
        },
      });
      ids.push(product.id);
    }
  }, 180_000);

  beforeEach(async () => {
    await prisma.product.updateMany({
      where: { recommendedOrder: { not: null } },
      data: { recommendedOrder: null },
    });
  });

  afterAll(async () => {
    // Shared database: these must not linger in later files' product lists.
    await prisma?.product.deleteMany({ where: { id: { in: ids } } });
    await prisma?.user.deleteMany({ where: { id: admin?.userId } });
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  async function callRecommended(
    method: RequestMethod,
    token: string | null,
    body?: object,
  ) {
    const handler = (await import('@/pages/api/product/recommended.page'))
      .default;
    const { req, res } = createMocks({
      method,
      url: '/api/product/recommended',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body,
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    return { status: res._getStatusCode(), json: res._getJSONData() };
  }

  async function listProducts(query: Record<string, string>) {
    const handler = (await import('@/pages/api/product/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/product',
      query,
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    return res._getJSONData().data as { id: string }[];
  }

  const save = (productIds: string[]) =>
    callRecommended('PUT', admin.accessToken, { productIds });

  const storedOrder = async () =>
    Object.fromEntries(
      (
        await prisma.product.findMany({
          where: { id: { in: ids } },
          select: { id: true, recommendedOrder: true },
        })
      ).map(({ id, recommendedOrder }) => [id, recommendedOrder]),
    );

  it('rejects callers without a staff token', async () => {
    expect((await callRecommended('GET', null)).status).toBe(401);
    expect(
      (await callRecommended('PUT', null, { productIds: [ids[0]] })).status,
    ).toBe(401);
  });

  it('saves the list in the given order and returns it', async () => {
    const { status, json } = await save([ids[2], ids[0], ids[3]]);
    expect(status).toBe(200);
    expect(json.data.map((p: { id: string }) => p.id)).toEqual([
      ids[2],
      ids[0],
      ids[3],
    ]);
    expect(json.data[0]).toMatchObject({
      imgUrl: '/media/rec-2.webp',
      isOutOfStock: false,
    });

    const fetched = await callRecommended('GET', admin.accessToken);
    expect(fetched.json.data.map((p: { id: string }) => p.id)).toEqual([
      ids[2],
      ids[0],
      ids[3],
    ]);
  });

  it('reorders and removes in one save, compacting positions', async () => {
    await save([ids[0], ids[1], ids[2], ids[3]]);
    await save([ids[3], ids[1]]);
    expect(await storedOrder()).toEqual({
      [ids[0]]: null,
      [ids[1]]: 1,
      [ids[2]]: null,
      [ids[3]]: 0,
    });
  });

  it('rejects an unknown or deleted product without changing anything', async () => {
    await save([ids[0]]);
    const unknown = await save([ids[1], 'missing-product']);
    expect(unknown.status).toBe(400);
    expect(unknown.json.message).toBe('productNotFound');

    const duplicate = await save([ids[1], ids[1]]);
    expect(duplicate.status).toBe(400);

    expect((await storedOrder())[ids[0]]).toBe(0);
    expect((await storedOrder())[ids[1]]).toBeNull();
  });

  it('filters and sorts the storefront list by the saved order', async () => {
    await save([ids[1], ids[3]]);

    const picked = await listProducts({
      recommended: '1',
      sortBy: 'recommended',
    });
    expect(picked.map(({ id }) => id)).toEqual([ids[1], ids[3]]);

    // Without the filter the picks lead even though they're the oldest rows,
    // and the rest of the catalog follows.
    const all = await listProducts({ sortBy: 'recommended' });
    expect(all.slice(0, 2).map(({ id }) => id)).toEqual([ids[1], ids[3]]);
    expect(all.length).toBeGreaterThan(2);
  });

  it('caps the page size with limit', async () => {
    await save([ids[0], ids[1], ids[2]]);
    const limited = await listProducts({
      recommended: '1',
      sortBy: 'recommended',
      limit: '2',
    });
    expect(limited.map(({ id }) => id)).toEqual([ids[0], ids[1]]);
  });

  it('drops a product from the list when it is soft-deleted', async () => {
    const extra = await prisma.product.create({
      data: {
        slug: `rec-extra-${Date.now()}`,
        name: JSON.stringify({ en: 'Rec extra' }),
        categoryId,
        brandId,
        imgUrls: [],
        tags: [],
        videoUrls: [],
      },
    });
    ids.push(extra.id);
    await save([extra.id, ids[0]]);

    const handler = (await import('@/pages/api/product/index.page')).default;
    const { req, res } = createMocks({
      method: 'DELETE',
      url: '/api/product',
      query: { productId: extra.id },
      headers: { authorization: `Bearer ${admin.accessToken}` },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);

    const row = await prisma.product.findUnique({ where: { id: extra.id } });
    expect(row?.deletedAt).not.toBeNull();
    expect(row?.recommendedOrder).toBeNull();
  });

  it('logs each moved, added and removed product', async () => {
    // Its own actor, so rows that earlier tests logged off the request path
    // can't land in this one's count. Each save's rows are awaited, and the
    // first save's cleared, before the next is checked.
    const logger = await createStaffPrincipal(prisma, UserRole.ADMIN);
    const saveAs = (productIds: string[]) =>
      callRecommended('PUT', logger.accessToken, { productIds });
    const rowsFor = (count: number) =>
      vi.waitFor(
        async () => {
          const found = await prisma.adminActivity.findMany({
            where: { userId: logger.userId },
          });
          if (found.length < count) throw new Error('waiting for activity');
          return found;
        },
        { timeout: 5000 },
      );
    try {
      await saveAs([ids[0], ids[1]]);
      await rowsFor(2);
      await prisma.adminActivity.deleteMany({
        where: { userId: logger.userId },
      });

      await saveAs([ids[1], ids[2]]);
      const rows = await rowsFor(3);
      expect(rows).toHaveLength(3);
      const byId = Object.fromEntries(
        rows.map((row) => [row.entityId, row.meta]),
      );
      expect(byId[ids[0]]).toEqual({
        name: 'Rec 0',
        changes: { recommended: { from: 1, to: null } },
      });
      expect(byId[ids[1]]).toEqual({
        name: 'Rec 1',
        changes: { recommended: { from: 2, to: 1 } },
      });
      expect(byId[ids[2]]).toEqual({
        name: 'Rec 2',
        changes: { recommended: { from: null, to: 2 } },
      });
    } finally {
      await prisma.user.deleteMany({ where: { id: logger.userId } });
    }
  });
});
