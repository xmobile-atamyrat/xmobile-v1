import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, UserRole } from '@prisma/client';
import { LISTING_RANK_MAX } from '@/pages/lib/listingRank';
import { createMocks, RequestMethod } from 'node-mocks-http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal, StaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Listing rank (integration)', () => {
  let prisma: PrismaClient;
  let admin: StaffPrincipal;
  let brandId: string;
  const categoryIds: string[] = [];
  let parentId: string;
  let childId: string;
  let otherId: string;
  // p0, p1 in the parent; p2, p3 in its child; o0 in an unrelated category.
  const ids: Record<'p0' | 'p1' | 'p2' | 'p3' | 'o0', string> = {
    p0: '',
    p1: '',
    p2: '',
    p3: '',
    o0: '',
  };

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    brandId = catalog.brandId;
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    admin = await createStaffPrincipal(prisma, UserRole.ADMIN);

    const stamp = Date.now();
    const parent = await prisma.category.create({
      data: { name: '{"en":"LR Parent"}', slug: `lr-parent-${stamp}` },
    });
    const child = await prisma.category.create({
      data: {
        name: '{"en":"LR Child"}',
        slug: `lr-child-${stamp}`,
        predecessorId: parent.id,
      },
    });
    const other = await prisma.category.create({
      data: { name: '{"en":"LR Other"}', slug: `lr-other-${stamp}` },
    });
    parentId = parent.id;
    childId = child.id;
    otherId = other.id;
    categoryIds.push(childId, parentId, otherId);

    const place: [keyof typeof ids, string][] = [
      ['p0', parentId],
      ['p1', parentId],
      ['p2', childId],
      ['p3', childId],
      ['o0', otherId],
    ];
    for (let i = 0; i < place.length; i += 1) {
      const [key, categoryId] = place[i];
      // eslint-disable-next-line no-await-in-loop
      const product = await prisma.product.create({
        data: {
          slug: `lr-${key}-${stamp}`,
          name: JSON.stringify({ en: `LR ${key}` }),
          categoryId,
          brandId,
          imgUrls: [`/media/lr-${key}.webp`],
          tags: [],
          videoUrls: [],
          createdAt: new Date(Date.UTC(2002, 0, 1 + i)),
        },
      });
      ids[key] = product.id;
    }
  }, 180_000);

  beforeEach(async () => {
    await prisma.product.updateMany({
      where: { listingRank: { not: null } },
      data: { listingRank: null },
    });
    await prisma.product.updateMany({
      where: { id: { in: Object.values(ids) } },
      data: { deletedAt: null },
    });
  });

  afterAll(async () => {
    await prisma?.product.deleteMany({
      where: { id: { in: Object.values(ids) } },
    });
    await prisma?.category.deleteMany({ where: { id: { in: categoryIds } } });
    await prisma?.user.deleteMany({ where: { id: admin?.userId } });
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  async function callListingRank(
    method: RequestMethod,
    token: string | null,
    { query, body }: { query?: Record<string, string>; body?: object } = {},
  ) {
    const handler = (await import('@/pages/api/product/listing-rank.page'))
      .default;
    const { req, res } = createMocks({
      method,
      url: '/api/product/listing-rank',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      query,
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
    return (res._getJSONData().data as { id: string }[]).map(({ id }) => id);
  }

  const save = (
    changes: { productId: string; listingRank: number | null }[],
    categoryId = parentId,
  ) =>
    callListingRank('PUT', admin.accessToken, {
      body: { categoryId, changes },
    });

  const rankOf = async (id: string) =>
    (
      await prisma.product.findUniqueOrThrow({
        where: { id },
        select: { listingRank: true },
      })
    ).listingRank;

  it('rejects callers without a staff token', async () => {
    expect(
      (await callListingRank('GET', null, { query: { categoryId: parentId } }))
        .status,
    ).toBe(401);
    expect(
      (
        await callListingRank('PUT', null, {
          body: {
            categoryId: parentId,
            changes: [{ productId: ids.p0, listingRank: 1 }],
          },
        })
      ).status,
    ).toBe(401);
  });

  it("lists a category's own and its subcategories' products", async () => {
    await prisma.product.update({
      where: { id: ids.o0 },
      data: { listingRank: 40 },
    });
    const { status, json } = await callListingRank('GET', admin.accessToken, {
      query: { categoryId: parentId },
    });
    expect(status).toBe(200);
    expect(json.data.ranked).toEqual([]);
    expect(
      json.data.unranked.map(({ id }: { id: string }) => id).sort(),
    ).toEqual([ids.p0, ids.p1, ids.p2, ids.p3].sort());
    expect(json.data.unranked[0]).toMatchObject({
      categoryName: expect.stringContaining('LR'),
      imgUrl: expect.stringContaining('/media/lr-'),
      isOutOfStock: false,
      listingRank: null,
    });
    expect(json.data.nextRank).toBe(41);
  });

  it('saves ranks and orders the storefront by them', async () => {
    const { status, json } = await save([
      { productId: ids.p2, listingRank: 5 },
      { productId: ids.p0, listingRank: 10 },
    ]);
    expect(status).toBe(200);
    expect(json.data.ranked.map(({ id }: { id: string }) => id)).toEqual([
      ids.p2,
      ids.p0,
    ]);

    // Ranked first, then the rest newest first.
    expect(await listProducts({ categoryId: parentId })).toEqual([
      ids.p2,
      ids.p0,
      ids.p3,
      ids.p1,
    ]);
    // The subcategory page is a slice of the same ranking.
    expect(await listProducts({ categoryId: childId })).toEqual([
      ids.p2,
      ids.p3,
    ]);
    // An explicit sort still wins.
    expect(
      await listProducts({ categoryId: parentId, sortBy: 'newest' }),
    ).toEqual([ids.p3, ids.p2, ids.p1, ids.p0]);
  });

  it('puts in-stock products ahead of ranked ones that sold out', async () => {
    await save([
      { productId: ids.p0, listingRank: 1 },
      { productId: ids.p1, listingRank: 2 },
    ]);
    await prisma.product.update({
      where: { id: ids.p0 },
      data: { outOfStockAt: new Date() },
    });
    try {
      const order = await listProducts({ categoryId: parentId });
      expect(order[0]).toBe(ids.p1);
      expect(order[order.length - 1]).toBe(ids.p0);
    } finally {
      await prisma.product.update({
        where: { id: ids.p0 },
        data: { outOfStockAt: null },
      });
    }
  });

  it('swaps numbers already held by the category in one save', async () => {
    await save([
      { productId: ids.p0, listingRank: 5 },
      { productId: ids.p2, listingRank: 10 },
    ]);
    const swapped = await save([
      { productId: ids.p0, listingRank: 10 },
      { productId: ids.p2, listingRank: 5 },
    ]);
    expect(swapped.status).toBe(200);
    expect(await rankOf(ids.p0)).toBe(10);
    expect(await rankOf(ids.p2)).toBe(5);
  });

  it('refuses a number held by a product elsewhere and names it', async () => {
    await prisma.product.update({
      where: { id: ids.o0 },
      data: { listingRank: 7 },
    });
    const { status, json } = await save([
      { productId: ids.p0, listingRank: 3 },
      { productId: ids.p1, listingRank: 7 },
    ]);
    expect(status).toBe(409);
    expect(json.message).toBe('listingRankTaken');
    expect(json.data).toEqual({
      conflict: {
        listingRank: 7,
        productName: JSON.stringify({ en: 'LR o0' }),
        categoryName: '{"en":"LR Other"}',
      },
      // A fresh number to retry with, past the one that was taken.
      nextRank: 8,
    });
    expect(await rankOf(ids.p0)).toBeNull();
    expect(await rankOf(ids.p1)).toBeNull();
    expect(await rankOf(ids.o0)).toBe(7);
  });

  it("refuses products outside the category's subtree", async () => {
    const { status, json } = await save(
      [
        { productId: ids.p0, listingRank: 1 },
        { productId: ids.o0, listingRank: 2 },
      ],
      parentId,
    );
    expect(status).toBe(409);
    expect(json.message).toBe('productNotInCategory');
    expect(await rankOf(ids.p0)).toBeNull();
    expect(await rankOf(ids.o0)).toBeNull();
  });

  it('refuses an unknown category before writing anything', async () => {
    const { status } = await save(
      [{ productId: ids.p0, listingRank: 1 }],
      'no-such-category',
    );
    expect(status).toBe(404);
    expect(await rankOf(ids.p0)).toBeNull();
  });

  it('keeps proposing valid numbers once the top number is taken', async () => {
    await prisma.product.update({
      where: { id: ids.o0 },
      data: { listingRank: LISTING_RANK_MAX },
    });
    await save([
      { productId: ids.p0, listingRank: 5 },
      { productId: ids.p2, listingRank: 6 },
    ]);
    const parent = await callListingRank('GET', admin.accessToken, {
      query: { categoryId: parentId },
    });
    // After the category's own last number, not past the maximum.
    expect(parent.json.data.nextRank).toBe(7);

    await prisma.product.update({
      where: { id: ids.p0 },
      data: { listingRank: 1 },
    });
    const other = await callListingRank('GET', admin.accessToken, {
      query: { categoryId: otherId },
    });
    // Only the maximum is held here, so the first free number overall.
    expect(other.json.data.nextRank).toBe(2);
  });

  it('returns just the unranked page for part=unranked', async () => {
    await save([{ productId: ids.p0, listingRank: 3 }]);
    const { status, json } = await callListingRank('GET', admin.accessToken, {
      query: { categoryId: parentId, part: 'unranked', page: '1' },
    });
    expect(status).toBe(200);
    expect(Object.keys(json.data).sort()).toEqual([
      'unranked',
      'unrankedHasMore',
    ]);
    expect(
      json.data.unranked.map(({ id }: { id: string }) => id).sort(),
    ).toEqual([ids.p1, ids.p2, ids.p3].sort());
  });

  it('takes a product out of the order with null', async () => {
    await save([{ productId: ids.p0, listingRank: 4 }]);
    const { status } = await save([{ productId: ids.p0, listingRank: null }]);
    expect(status).toBe(200);
    expect(await rankOf(ids.p0)).toBeNull();
  });

  it('refuses a deleted product without writing anything', async () => {
    await prisma.product.update({
      where: { id: ids.p1 },
      data: { deletedAt: new Date() },
    });
    const { status, json } = await save([
      { productId: ids.p0, listingRank: 2 },
      { productId: ids.p1, listingRank: 3 },
    ]);
    expect(status).toBe(409);
    expect(json.message).toBe('productNotFound');
    expect(await rankOf(ids.p0)).toBeNull();
  });

  it('rejects a body that repeats a product or a number', async () => {
    const repeatedNumber = await save([
      { productId: ids.p0, listingRank: 2 },
      { productId: ids.p1, listingRank: 2 },
    ]);
    expect(repeatedNumber.status).toBe(400);
    const repeatedProduct = await save([
      { productId: ids.p0, listingRank: 2 },
      { productId: ids.p0, listingRank: 3 },
    ]);
    expect(repeatedProduct.status).toBe(400);
    const outOfRange = await save([{ productId: ids.p0, listingRank: 0 }]);
    expect(outOfRange.status).toBe(400);
  });

  it('clears the number when a product is deleted', async () => {
    await save([{ productId: ids.p3, listingRank: 9 }]);
    const handler = (await import('@/pages/api/product/index.page')).default;
    const { req, res } = createMocks({
      method: 'DELETE',
      url: '/api/product',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      query: { productId: ids.p3 },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    expect(await rankOf(ids.p3)).toBeNull();
  });
});
