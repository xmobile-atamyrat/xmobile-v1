import { Readable } from 'node:stream';

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Admin activity logging (integration)', () => {
  let prisma: PrismaClient;
  let adminToken: string;
  let adminUserId: string;
  let adminName: string;

  const call = async (
    modulePath: string,
    options: Parameters<typeof createMocks>[0],
  ) => {
    const handler = (await import(modulePath)).default;
    const { req, res } = createMocks({
      ...options,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    return { status: res._getStatusCode(), body: JSON.parse(res._getData()) };
  };

  const activityFor = (entity: string, action: string, targetId: string) =>
    vi.waitFor(
      async () => {
        const rows = await prisma.adminActivity.findMany({
          where: {
            userId: adminUserId,
            entity: entity as never,
            action: action as never,
            targetId,
          },
        });
        expect(rows).toHaveLength(1);
        return rows[0];
      },
      { timeout: 5000, interval: 100 },
    );

  const callMultipart = async (
    modulePath: string,
    options: {
      method: 'POST' | 'PUT' | 'DELETE';
      url: string;
      query?: Record<string, string>;
      fields?: Record<string, string>;
    },
  ) => {
    const handler = (await import(modulePath)).default;
    const boundary = '----actlogboundary';
    const chunks = Object.entries(options.fields ?? {}).map(
      ([name, value]) =>
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}`,
    );
    chunks.push(`--${boundary}--`);
    const stream = Readable.from(Buffer.from(chunks.join('\r\n'), 'utf8'));
    const { res } = createMocks({ method: options.method, url: options.url });
    const req = Object.assign(stream, {
      url: options.url,
      method: options.method,
      query: options.query ?? {},
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
    }) as unknown as NextApiRequest;
    await handler(req, res as unknown as NextApiResponse);
    const raw = res._getData() as string;
    return {
      status: res._getStatusCode(),
      body: raw ? JSON.parse(raw) : {},
    };
  };

  const settle = () =>
    new Promise((resolve) => {
      setTimeout(resolve, 400);
    });

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    const admin = await createStaffPrincipal(prisma, 'ADMIN');
    adminToken = admin.accessToken;
    adminUserId = admin.userId;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: adminUserId },
    });
    adminName = user.name;
  }, 180_000);

  afterAll(async () => {
    await prisma.adminActivity.deleteMany({ where: { userName: adminName } });
    await prisma.color
      .deleteMany({ where: { name: { startsWith: 'ActLog' } } })
      .catch(() => {});
    await prisma.brand
      .deleteMany({ where: { name: { startsWith: 'ActLog' } } })
      .catch(() => {});
    await prisma.promoBanner
      .deleteMany({
        where: { imgUrls: { path: ['default'], string_contains: 'actlog' } },
      })
      .catch(() => {});
    await prisma.prices
      .deleteMany({ where: { name: { startsWith: 'ActLog' } } })
      .catch(() => {});
    await prisma.dollarRate
      .deleteMany({ where: { name: { startsWith: 'ActLog' } } })
      .catch(() => {});
    await prisma.product
      .deleteMany({ where: { slug: { startsWith: 'actlog' } } })
      .catch(() => {});
    await prisma.category
      .deleteMany({ where: { slug: { startsWith: 'actlog' } } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
    await prisma.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('records color create, update and delete with the actor name', async () => {
    const created = await call('@/pages/api/colors/index.page', {
      method: 'POST',
      url: '/api/colors',
      body: { name: 'ActLog Teal', hex: '#008080' },
    });
    expect(created.status).toBe(200);
    const colorId = created.body.data.id as string;

    const createRow = await activityFor('COLOR', 'CREATE', colorId);
    expect(createRow.userName).toBe(adminName);
    expect(createRow.meta).toEqual({ name: 'ActLog Teal', hex: '#008080' });

    await call('@/pages/api/colors/index.page', {
      method: 'PUT',
      url: '/api/colors',
      body: { colorPairs: [{ id: colorId, hex: '#009999' }] },
    });
    const updateRow = await activityFor('COLOR', 'UPDATE', colorId);
    expect(updateRow.meta).toEqual({
      name: 'ActLog Teal',
      changes: { hex: { from: '#008080', to: '#009999' } },
    });

    await call('@/pages/api/colors/index.page', {
      method: 'DELETE',
      url: '/api/colors',
      query: { id: colorId },
    });
    const deleteRow = await activityFor('COLOR', 'DELETE', colorId);
    expect(deleteRow.meta).toMatchObject({ name: 'ActLog Teal' });
  });

  it('does not log a color update that changes nothing', async () => {
    const color = await prisma.color.create({
      data: { name: 'ActLog Same', hex: '#111111' },
    });
    await call('@/pages/api/colors/index.page', {
      method: 'PUT',
      url: '/api/colors',
      body: { colorPairs: [{ id: color.id, name: 'ActLog Same' }] },
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 400);
    });
    const rows = await prisma.adminActivity.findMany({
      where: { targetId: color.id },
    });
    expect(rows).toHaveLength(0);
  });

  it('records brand create, rename and delete', async () => {
    const created = await call('@/pages/api/brand/index.page', {
      method: 'POST',
      url: '/api/brand',
      body: { name: 'ActLog Brand' },
    });
    expect(created.status).toBe(201);
    const brandId = created.body.data.id as string;
    await activityFor('BRAND', 'CREATE', brandId);

    await call('@/pages/api/brand/index.page', {
      method: 'PUT',
      url: '/api/brand',
      body: { id: brandId, name: 'ActLog Brand 2' },
    });
    const renameRow = await activityFor('BRAND', 'UPDATE', brandId);
    expect(renameRow.meta).toEqual({
      name: 'ActLog Brand 2',
      changes: { name: { from: 'ActLog Brand', to: 'ActLog Brand 2' } },
    });

    await call('@/pages/api/brand/index.page', {
      method: 'DELETE',
      url: '/api/brand',
      query: { id: brandId },
    });
    await activityFor('BRAND', 'DELETE', brandId);
  });

  it('records category create, edit, reorder, move and delete', async () => {
    const parent = await callMultipart('@/pages/api/category.page', {
      method: 'POST',
      url: '/api/category',
      fields: { name: JSON.stringify({ en: 'ActLog Parent' }) },
    });
    expect(parent.status).toBe(200);
    const parentId = parent.body.data.id as string;
    await activityFor('CATEGORY', 'CREATE', parentId);

    const child = await callMultipart('@/pages/api/category.page', {
      method: 'POST',
      url: '/api/category',
      fields: {
        name: JSON.stringify({ en: 'ActLog Child' }),
        predecessorId: parentId,
      },
    });
    const childId = child.body.data.id as string;
    const childCreate = await activityFor('CATEGORY', 'CREATE', childId);
    expect(childCreate.meta).toEqual({
      name: 'ActLog Child',
      parent: 'ActLog Parent',
    });

    await callMultipart('@/pages/api/category.page', {
      method: 'PUT',
      url: '/api/category',
      query: { categoryId: childId },
      fields: { name: JSON.stringify({ en: 'ActLog Child Renamed' }) },
    });
    const edit = await activityFor('CATEGORY', 'UPDATE', childId);
    expect(edit.meta).toEqual({
      name: 'ActLog Child Renamed',
      changes: { name: { from: 'ActLog Child', to: 'ActLog Child Renamed' } },
    });

    const sibling = await callMultipart('@/pages/api/category.page', {
      method: 'POST',
      url: '/api/category',
      fields: {
        name: JSON.stringify({ en: 'ActLog Sibling' }),
        predecessorId: parentId,
      },
    });
    expect(sibling.status).toBe(200);

    await call('@/pages/api/category/hierarchy.page', {
      method: 'POST',
      url: '/api/category/hierarchy',
      body: {
        action: 'reorderSibling',
        categoryId: childId,
        direction: 'down',
      },
    });
    const reorder = await activityFor('CATEGORY', 'REORDER', childId);
    expect(reorder.meta).toEqual({
      name: 'ActLog Child Renamed',
      direction: 'down',
    });

    await call('@/pages/api/category/hierarchy.page', {
      method: 'POST',
      url: '/api/category/hierarchy',
      body: {
        action: 'setParent',
        categoryId: childId,
        newPredecessorId: null,
      },
    });
    await vi.waitFor(async () => {
      expect(
        await prisma.adminActivity.count({
          where: { targetId: childId, action: 'UPDATE' },
        }),
      ).toBe(2);
    });
    const move = (
      await prisma.adminActivity.findMany({
        where: { targetId: childId, action: 'UPDATE' },
        orderBy: { createdAt: 'desc' },
      })
    )[0];
    expect(move.meta).toMatchObject({
      changes: { parent: { from: 'ActLog Parent', to: null } },
    });

    await callMultipart('@/pages/api/category.page', {
      method: 'DELETE',
      url: '/api/category',
      query: { categoryId: parentId },
    });
    const del = await activityFor('CATEGORY', 'DELETE', parentId);
    expect(del.meta).toEqual({
      name: 'ActLog Parent',
      subcategories: 1,
      products: 0,
    });
  });

  it('does not log a category edit that changes nothing', async () => {
    const created = await callMultipart('@/pages/api/category.page', {
      method: 'POST',
      url: '/api/category',
      fields: { name: JSON.stringify({ en: 'ActLog Quiet' }) },
    });
    const id = created.body.data.id as string;
    await activityFor('CATEGORY', 'CREATE', id);

    await callMultipart('@/pages/api/category.page', {
      method: 'PUT',
      url: '/api/category',
      query: { categoryId: id },
      fields: { name: JSON.stringify({ en: 'ActLog Quiet' }) },
    });
    await settle();
    expect(
      await prisma.adminActivity.count({
        where: { targetId: id, action: 'UPDATE' },
      }),
    ).toBe(0);
  });

  it('records banner create, update and delete by position', async () => {
    const created = await callMultipart('@/pages/api/promo-banner.page', {
      method: 'POST',
      url: '/api/promo-banner',
      fields: {
        imageUrl_default: 'https://example.com/actlog-a.jpg',
        sortOrder: '901',
        isActive: 'true',
      },
    });
    expect(created.status).toBe(201);
    const bannerId = created.body.data.id as string;
    const createRow = await activityFor('BANNER', 'CREATE', bannerId);
    expect(createRow.meta).toEqual({ position: 901, active: true });

    await callMultipart('@/pages/api/promo-banner.page', {
      method: 'PUT',
      url: '/api/promo-banner',
      query: { id: bannerId },
      fields: { isActive: 'false', sortOrder: '901' },
    });
    const updateRow = await activityFor('BANNER', 'UPDATE', bannerId);
    expect(updateRow.meta).toEqual({
      position: 901,
      changes: { isActive: { from: true, to: false } },
    });

    await callMultipart('@/pages/api/promo-banner.page', {
      method: 'DELETE',
      url: '/api/promo-banner',
      query: { id: bannerId },
    });
    const deleteRow = await activityFor('BANNER', 'DELETE', bannerId);
    expect(deleteRow.meta).toEqual({ position: 901 });
  });

  it('does not log a banner save that changes nothing', async () => {
    const created = await callMultipart('@/pages/api/promo-banner.page', {
      method: 'POST',
      url: '/api/promo-banner',
      fields: {
        imageUrl_default: 'https://example.com/actlog-b.jpg',
        sortOrder: '902',
        isActive: 'true',
      },
    });
    const bannerId = created.body.data.id as string;
    await activityFor('BANNER', 'CREATE', bannerId);

    await callMultipart('@/pages/api/promo-banner.page', {
      method: 'PUT',
      url: '/api/promo-banner',
      query: { id: bannerId },
      fields: { sortOrder: '902' },
    });
    await settle();
    expect(
      await prisma.adminActivity.count({
        where: { targetId: bannerId, action: 'UPDATE' },
      }),
    ).toBe(0);
  });

  it('records product create, edit, stock flip, image reorder and delete', async () => {
    const category = await prisma.category.create({
      data: { name: '{"en":"ActLog ProdCat"}', slug: 'actlog-prodcat' },
    });
    const img = (n: string) => `https://cdn.example.com/actlog-${n}.jpg`;

    const created = await callMultipart('@/pages/api/product/index.page', {
      method: 'POST',
      url: '/api/product',
      fields: {
        name: JSON.stringify({ en: 'ActLog Phone' }),
        categoryId: category.id,
        imageUrls: JSON.stringify([img('a'), img('b')]),
      },
    });
    expect(created.status).toBe(200);
    const productId = created.body.data.id as string;
    const createRow = await activityFor('PRODUCT', 'CREATE', productId);
    expect(createRow.meta).toEqual({
      name: 'ActLog Phone',
      category: 'ActLog ProdCat',
      images: 2,
    });

    await callMultipart('@/pages/api/product/index.page', {
      method: 'PUT',
      url: '/api/product',
      query: { productId },
      fields: {
        categoryId: category.id,
        imageOrder: JSON.stringify([img('b'), img('a')]),
      },
    });
    const reorderRow = await activityFor('PRODUCT', 'REORDER', productId);
    expect(reorderRow.meta).toEqual({ name: 'ActLog Phone' });

    await callMultipart('@/pages/api/product/index.page', {
      method: 'PUT',
      url: '/api/product',
      query: { productId },
      fields: {
        categoryId: category.id,
        name: JSON.stringify({ en: 'ActLog Phone 2' }),
        isOutOfStock: 'true',
      },
    });
    const updateRow = await activityFor('PRODUCT', 'UPDATE', productId);
    expect(updateRow.meta).toEqual({
      name: 'ActLog Phone 2',
      changes: {
        name: { from: 'ActLog Phone', to: 'ActLog Phone 2' },
        outOfStock: { from: false, to: true },
      },
    });

    await callMultipart('@/pages/api/product/index.page', {
      method: 'PUT',
      url: '/api/product',
      query: { productId },
      fields: {
        categoryId: category.id,
        name: JSON.stringify({ en: 'ActLog Phone 2' }),
        isOutOfStock: 'true',
      },
    });
    await settle();
    expect(
      await prisma.adminActivity.count({
        where: { targetId: productId, action: { in: ['UPDATE', 'REORDER'] } },
      }),
    ).toBe(2);

    await callMultipart('@/pages/api/product/index.page', {
      method: 'DELETE',
      url: '/api/product',
      query: { productId },
    });
    const deleteRow = await activityFor('PRODUCT', 'DELETE', productId);
    expect(deleteRow.meta).toEqual({ name: 'ActLog Phone 2' });
  });

  it('records price create, edit, no-op save and delete', async () => {
    const created = await call('@/pages/api/prices/index.page', {
      method: 'POST',
      url: '/api/prices',
      body: { name: 'ActLog 128gb', price: '340', priceInTmt: '6664' },
    });
    expect(created.status).toBe(200);
    const priceId = created.body.data.id as string;
    const createRow = await activityFor('PRICE', 'CREATE', priceId);
    expect(createRow.meta).toEqual({ name: 'ActLog 128gb', price: '340' });

    await call('@/pages/api/prices/index.page', {
      method: 'PUT',
      url: '/api/prices',
      body: {
        pricePairs: [{ id: priceId, name: 'ActLog 128gb', price: '355' }],
      },
    });
    const updateRow = await activityFor('PRICE', 'UPDATE', priceId);
    expect(updateRow.meta).toEqual({
      name: 'ActLog 128gb',
      changes: { price: { from: '340', to: '355' } },
    });

    await call('@/pages/api/prices/index.page', {
      method: 'PUT',
      url: '/api/prices',
      body: {
        pricePairs: [{ id: priceId, name: 'ActLog 128gb', price: '355' }],
      },
    });
    await settle();
    expect(
      await prisma.adminActivity.count({
        where: { targetId: priceId, action: 'UPDATE' },
      }),
    ).toBe(1);

    await call('@/pages/api/prices/index.page', {
      method: 'DELETE',
      url: '/api/prices',
      query: { id: priceId },
    });
    const deleteRow = await activityFor('PRICE', 'DELETE', priceId);
    expect(deleteRow.meta).toEqual({ name: 'ActLog 128gb', price: '355' });
  });

  it('collapses a large price save into one summary row', async () => {
    const rows = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        prisma.prices.create({
          data: { name: `ActLog Bulk ${i}`, price: '10', priceInTmt: '196' },
        }),
      ),
    );
    await call('@/pages/api/prices/index.page', {
      method: 'PUT',
      url: '/api/prices',
      body: {
        pricePairs: rows.map((row) => ({
          id: row.id,
          name: row.name,
          price: '11',
        })),
      },
    });
    await vi.waitFor(async () => {
      const summary = await prisma.adminActivity.findMany({
        where: {
          userId: adminUserId,
          entity: 'PRICE',
          action: 'UPDATE',
          targetId: null,
        },
      });
      expect(summary).toHaveLength(1);
      expect(summary[0].meta).toEqual({ count: 12, fields: ['price'] });
    });
    expect(
      await prisma.adminActivity.count({
        where: { targetId: { in: rows.map((row) => row.id) } },
      }),
    ).toBe(0);
  });

  it('records one row for a rate change and how many prices it recalculated', async () => {
    const created = await call('@/pages/api/prices/rate.page', {
      method: 'POST',
      url: '/api/prices/rate',
      body: { name: 'ActLog Rate', rate: 19.5 },
    });
    expect(created.status).toBe(200);
    const rateId = created.body.data.id as number;
    const createRow = await activityFor(
      'CURRENCY_RATE',
      'CREATE',
      String(rateId),
    );
    expect(createRow.meta).toMatchObject({ name: 'ActLog Rate', rate: 19.5 });

    await Promise.all(
      [1, 2, 3].map((i) =>
        prisma.prices.create({
          data: {
            name: `ActLog Rated ${i}`,
            price: '100',
            priceInTmt: '1950',
            dollarRateId: rateId,
          },
        }),
      ),
    );

    const updated = await call('@/pages/api/prices/rate.page', {
      method: 'PUT',
      url: '/api/prices/rate',
      body: { id: rateId, rate: 19.6 },
    });
    expect(updated.status).toBe(200);
    const updateRow = await activityFor(
      'CURRENCY_RATE',
      'UPDATE',
      String(rateId),
    );
    expect(updateRow.meta).toMatchObject({
      name: 'ActLog Rate',
      changes: { rate: { from: 19.5, to: 19.6 } },
      recalculatedPrices: 3,
    });
    expect(
      await prisma.adminActivity.count({
        where: {
          entity: 'PRICE',
          targetId: { not: null },
          userId: adminUserId,
          meta: { path: ['name'], string_starts_with: 'ActLog Rated' },
        },
      }),
    ).toBe(0);

    const priceIds = (
      await prisma.prices.findMany({
        where: { name: { startsWith: 'ActLog Rated' } },
        select: { id: true },
      })
    ).map((row) => row.id);
    const other = await call('@/pages/api/prices/rate.page', {
      method: 'POST',
      url: '/api/prices/rate',
      body: { name: 'ActLog Rate B', rate: 20 },
    });
    const otherId = other.body.data.id as number;
    await call('@/pages/api/prices/assign-rate.page', {
      method: 'PUT',
      url: '/api/prices/assign-rate',
      body: { priceIds: priceIds.slice(0, 2), rateId: otherId },
    });
    await vi.waitFor(async () => {
      const rows = await prisma.adminActivity.findMany({
        where: {
          entity: 'PRICE',
          action: 'UPDATE',
          targetId: null,
          userId: adminUserId,
        },
      });
      expect(
        rows.some((row) => (row.meta as any)?.rate === 'ActLog Rate B'),
      ).toBe(true);
    });

    if (
      (await prisma.dollarRate.findFirst({ where: { isDefault: true } })) ==
      null
    ) {
      await prisma.dollarRate.create({
        data: { name: 'ActLog Default', rate: 19, isDefault: true },
      });
    }
    const removed = await call('@/pages/api/prices/rate.page', {
      method: 'DELETE',
      url: '/api/prices/rate',
      body: { id: otherId },
    });
    expect(removed.status).toBe(200);
    const deleteRow = await activityFor(
      'CURRENCY_RATE',
      'DELETE',
      String(otherId),
    );
    expect(deleteRow.meta).toMatchObject({ name: 'ActLog Rate B' });
  });

  it('keeps the row and the name after the actor is deleted', async () => {
    const other = await createStaffPrincipal(prisma, 'ADMIN');
    const otherUser = await prisma.user.findUniqueOrThrow({
      where: { id: other.userId },
    });
    const row = await prisma.adminActivity.create({
      data: {
        userId: other.userId,
        userName: otherUser.name,
        entity: 'BRAND',
        action: 'CREATE',
        targetId: 'x',
      },
    });

    await prisma.user.delete({ where: { id: other.userId } });

    const kept = await prisma.adminActivity.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(kept.userId).toBeNull();
    expect(kept.userName).toBe(otherUser.name);
    await prisma.adminActivity.delete({ where: { id: row.id } });
  });
});
