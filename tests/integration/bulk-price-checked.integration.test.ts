import { PrismaClient, UserRole } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

const PREFIX = 'bulk-checked-test ';
const LAST_CHECKED = new Date('2026-01-01T00:00:00Z');

describe('bulk import and priceCheckedAt (integration)', () => {
  let prisma: PrismaClient;
  let staffUserId: string;
  let accessToken: string;
  let categoryId: string;
  let categorySlug: string;
  let createdRateId: number | undefined;

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    categoryId = catalog.categoryId;
    ({ slug: categorySlug } = await prisma.category.findUniqueOrThrow({
      where: { id: categoryId },
    }));
    if (
      (await prisma.dollarRate.findFirst({ where: { currency: 'TMT' } })) ==
      null
    ) {
      ({ id: createdRateId } = await prisma.dollarRate.create({
        data: { name: `${PREFIX}rate`, rate: 19.5, currency: 'TMT' },
      }));
    }
    const staff = await createStaffPrincipal(prisma, UserRole.SUPERUSER);
    staffUserId = staff.userId;
    accessToken = staff.accessToken;
  });

  afterAll(async () => {
    await prisma.prices.deleteMany({ where: { name: { startsWith: PREFIX } } });
    if (createdRateId != null) {
      await prisma.dollarRate.delete({ where: { id: createdRateId } });
    }
    await prisma.user.deleteMany({ where: { id: staffUserId } });
    await prisma.$disconnect();
    resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  // A pool price whose stored manat matches no rate, so a USD-only row always
  // derives a different figure.
  const seedPrice = (name: string) =>
    prisma.prices.create({
      data: {
        name: `${PREFIX}${name}`,
        price: '100',
        priceInTmt: '1',
        categoryId,
        priceCheckedAt: LAST_CHECKED,
      },
    });

  const importRow = async (
    price: { id: string; name: string },
    cells: { priceUsd: string; priceTmt?: string },
  ) => {
    const handler = (await import('@/pages/api/product/bulk.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/product/bulk',
      headers: { authorization: `Bearer ${accessToken}` },
      body: {
        products: [],
        variants: [
          {
            row: 2,
            priceId: price.id,
            productId: '',
            spec: price.name,
            categorySlug,
            ...cells,
          },
        ],
        hasVariantsSheet: true,
        dryRun: false,
      },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getJSONData().data).toMatchObject({
      updatedPriceCount: 1,
      errors: [],
    });
    return prisma.prices.findUniqueOrThrow({ where: { id: price.id } });
  };

  it('keeps the date when only the calculated manat moved', async () => {
    const price = await seedPrice('rate only');

    const saved = await importRow(price, { priceUsd: '100' });

    expect(saved.priceInTmt).not.toBe('1');
    expect(saved.priceCheckedAt).toEqual(LAST_CHECKED);
  });

  it('resets the date when the USD amount changed', async () => {
    const price = await seedPrice('new usd');

    const saved = await importRow(price, { priceUsd: '150' });

    expect(saved.priceCheckedAt!.getTime()).toBeGreaterThan(
      LAST_CHECKED.getTime(),
    );
  });

  it('resets the date when a typed manat amount changed', async () => {
    const price = await seedPrice('typed tmt');

    const saved = await importRow(price, { priceUsd: '100', priceTmt: '2' });

    expect(saved.priceCheckedAt!.getTime()).toBeGreaterThan(
      LAST_CHECKED.getTime(),
    );
  });
});
