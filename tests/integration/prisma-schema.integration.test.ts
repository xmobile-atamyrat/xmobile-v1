import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Prisma schema + catalog seed (integration)', () => {
  let prisma: PrismaClient;
  let categoryId: string;
  let priceId: string;
  let productId: string;

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    categoryId = catalog.categoryId;
    priceId = catalog.priceId;
    productId = catalog.productId;

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

  it('connects and sees shared seeded product linked to price', async () => {
    const p = await prisma.product.findUnique({ where: { id: productId } });
    expect(p?.categoryId).toBe(categoryId);
    expect(p?.price).toBe(`[${priceId}]`);
    expect(p?.deletedAt).toBeNull();
  });

  it('treats soft-deleted products as inactive for deletedAt filter', async () => {
    const dead = await prisma.product.create({
      data: {
        name: '{"en":"Deleted"}',
        slug: 'deleted-product',
        categoryId,
        imgUrls: [],
        tags: [],
        videoUrls: [],
        deletedAt: new Date(),
      },
    });
    const active = await prisma.product.count({
      where: { id: dead.id, deletedAt: null },
    });
    expect(active).toBe(0);
    await prisma.product.delete({ where: { id: dead.id } });
  });
});
