import { PrismaClient, UserRole } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks, RequestMethod } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal, StaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

// The database is shared by every integration file, so rows are namespaced and
// assertions only look at the ones created here.
const PREFIX = 'stale-test ';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const daysAgo = (days: number) => new Date(Date.now() - days * MS_PER_DAY);

describe('stale price warnings (integration)', () => {
  let prisma: PrismaClient;
  let categoryId: string;
  let rateId: number;
  let admin: StaffPrincipal;
  let superuser: StaffPrincipal;
  let customer: StaffPrincipal;
  let sequence = 0;

  const seedPrice = (checkedDaysAgo: number, soldOut = false) => {
    sequence += 1;
    return prisma.prices.create({
      data: {
        name: `${PREFIX}price ${sequence}`,
        price: '100',
        priceInTmt: '1950',
        displayPriceTmt: '1950',
        priceCheckedAt: daysAgo(checkedDaysAgo),
        outOfStockAt: soldOut ? new Date() : null,
      },
    });
  };

  const seedProduct = (
    priceId: string,
    over: {
      tagPriceIds?: string[];
      outOfStockAt?: Date;
      deletedAt?: Date;
    } = {},
  ) => {
    sequence += 1;
    const { tagPriceIds = [], ...state } = over;
    return prisma.product.create({
      data: {
        name: JSON.stringify({ en: `${PREFIX}product ${sequence}` }),
        slug: `stale-test-${Date.now()}-${sequence}`,
        categoryId,
        price: `[${priceId}]`,
        tags: tagPriceIds.map((id, index) => `spec${index} [${id}]`),
        imgUrls: [],
        videoUrls: [],
        ...state,
      },
    });
  };

  const getStaleList = async (
    accessToken?: string,
    method: RequestMethod = 'GET',
  ) => {
    const handler = (await import('@/pages/api/prices/stale.page')).default;
    const { req, res } = createMocks({
      method,
      url: '/api/prices/stale',
      headers:
        accessToken == null ? {} : { authorization: `Bearer ${accessToken}` },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    return res;
  };

  const savePrices = async (pricePairs: Record<string, unknown>[]) => {
    const handler = (await import('@/pages/api/prices/index.page')).default;
    const { req, res } = createMocks({
      method: 'PUT' as RequestMethod,
      url: '/api/prices',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      body: { pricePairs },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
  };

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    categoryId = catalog.categoryId;
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    ({ id: rateId } = await prisma.dollarRate.create({
      data: { name: `${PREFIX}rate`, rate: 21, currency: 'TMT' },
    }));
    admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    superuser = await createStaffPrincipal(prisma, UserRole.SUPERUSER);
    customer = await createStaffPrincipal(prisma, UserRole.FREE);
  });

  afterAll(async () => {
    await prisma.product.deleteMany({
      where: { slug: { startsWith: 'stale-test-' } },
    });
    await prisma.prices.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.dollarRate.delete({ where: { id: rateId } });
    await prisma.user.deleteMany({
      where: {
        id: { in: [admin.userId, superuser.userId, customer.userId] },
      },
    });
    await prisma.$disconnect();
    resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  describe('who may read /api/prices/stale', () => {
    it.each([
      ['an admin', () => admin],
      ['a superuser', () => superuser],
    ])('answers %s', async (_label, principal) => {
      const res = await getStaleList(principal().accessToken);

      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData().success).toBe(true);
    });

    it('refuses a customer without leaking the list', async () => {
      const res = await getStaleList(customer.accessToken);

      expect(res._getStatusCode()).toBe(401);
      expect(res._getJSONData().data).toBeUndefined();
    });

    it('refuses a signed-out visitor', async () => {
      const res = await getStaleList();

      expect(res._getStatusCode()).toBe(401);
      expect(res._getJSONData().data).toBeUndefined();
    });

    it('only allows reading', async () => {
      const res = await getStaleList(admin.accessToken, 'POST');

      expect(res._getStatusCode()).toBe(405);
    });
  });

  describe('what the list contains', () => {
    it('lists old products by tier and leaves the rest out', async () => {
      const orange = await seedProduct((await seedPrice(40)).id);
      const red = await seedProduct((await seedPrice(100)).id);
      const fresh = await seedProduct((await seedPrice(5)).id);
      const soldOut = await seedProduct((await seedPrice(100)).id, {
        outOfStockAt: new Date(),
      });
      const deleted = await seedProduct((await seedPrice(100)).id, {
        deletedAt: new Date(),
      });

      const { data } = (await getStaleList(admin.accessToken))._getJSONData();

      expect(data[orange.id]).toEqual({ tier: 'orange', days: 40 });
      expect(data[red.id]).toEqual({ tier: 'red', days: 100 });
      expect(data).not.toHaveProperty(fresh.id);
      expect(data).not.toHaveProperty(soldOut.id);
      expect(data).not.toHaveProperty(deleted.id);
    });

    it('goes by the oldest price still on sale among the variants', async () => {
      const base = await seedPrice(1);
      const oldVariant = await seedPrice(45);
      const soldOutVariant = await seedPrice(200, true);
      const product = await seedProduct(base.id, {
        tagPriceIds: [oldVariant.id, soldOutVariant.id],
      });

      const { data } = (await getStaleList(admin.accessToken))._getJSONData();

      expect(data[product.id]).toEqual({ tier: 'orange', days: 45 });
    });
  });

  describe('saving on Update Prices', () => {
    const checkedAtOf = async (id: string) =>
      (await prisma.prices.findUniqueOrThrow({ where: { id } }))
        .priceCheckedAt!;

    it.each<[string, Record<string, unknown>]>([
      ['a new USD amount', { price: '120' }],
      ['a new manat amount', { priceInTmt: '2000' }],
      ['the refresh icon', { markChecked: true }],
      ['an added sale', { salePriceTmt: '1800' }],
    ])('resets the date for %s', async (_label, change) => {
      const price = await seedPrice(100);
      const startedAt = Date.now();

      await savePrices([{ id: price.id, ...change }]);

      expect((await checkedAtOf(price.id)).getTime()).toBeGreaterThanOrEqual(
        startedAt,
      );
    });

    it.each<[string, () => Record<string, unknown>]>([
      ['a rename', () => ({ name: `${PREFIX}renamed` })],
      ['a shown-price edit', () => ({ displayPriceTmt: '1990' })],
      ['resending the same amounts', () => ({ price: '100.00' })],
      ['a rate change', () => ({ dollarRateId: rateId, priceInTmt: '2100' })],
    ])('keeps the date for %s', async (_label, change) => {
      const price = await seedPrice(100);

      await savePrices([{ id: price.id, ...change() }]);

      expect(await checkedAtOf(price.id)).toEqual(price.priceCheckedAt);
    });

    const seedPriceOnSale = async () => {
      const { id } = await seedPrice(100);
      return prisma.prices.update({
        where: { id },
        data: { salePriceTmt: '1800' },
      });
    };

    it('resets the date for a changed sale price', async () => {
      const price = await seedPriceOnSale();
      const startedAt = Date.now();

      await savePrices([{ id: price.id, salePriceTmt: '1700' }]);

      expect((await checkedAtOf(price.id)).getTime()).toBeGreaterThanOrEqual(
        startedAt,
      );
    });

    it.each<[string, string | null]>([
      ['removing a sale', null],
      ['resending the same sale price', '1800.00'],
    ])('keeps the date for %s', async (_label, salePriceTmt) => {
      const price = await seedPriceOnSale();

      await savePrices([{ id: price.id, salePriceTmt }]);

      expect(await checkedAtOf(price.id)).toEqual(price.priceCheckedAt);
    });

    it('removes a confirmed product from the stale list', async () => {
      const price = await seedPrice(100);
      const product = await seedProduct(price.id);
      const before = (await getStaleList(admin.accessToken))._getJSONData();
      expect(before.data).toHaveProperty(product.id);

      await savePrices([{ id: price.id, markChecked: true }]);

      const after = (await getStaleList(admin.accessToken))._getJSONData();
      expect(after.data).not.toHaveProperty(product.id);
    });
  });
});
