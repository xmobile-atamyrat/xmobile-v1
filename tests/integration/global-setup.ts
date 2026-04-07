import { PrismaClient } from '@prisma/client';
import type { TestProject } from 'vitest/node';

import { startIntegrationDatabase } from './setup-database';
import type { IntegrationCatalog } from './shared/integration-types';

/**
 * One Postgres container + migrated schema + shared storefront seed for all integration files.
 */
export default async function globalSetup(project: TestProject) {
  const { databaseUrl, stop } = await startIntegrationDatabase();

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  await prisma.$connect();

  const cat = await prisma.category.create({
    data: {
      name: '{"en":"Integration category"}',
      slug: 'integration-category',
    },
  });
  const price = await prisma.prices.create({
    data: { name: 'Integration price', price: '1', priceInTmt: '99.99' },
  });
  const product = await prisma.product.create({
    data: {
      slug: 'integration-phone',
      name: '{"en":"Integration phone"}',
      categoryId: cat.id,
      imgUrls: [],
      tags: [],
      videoUrls: [],
      price: `[${price.id}]`,
    },
  });

  await prisma.$disconnect();

  const catalog: IntegrationCatalog = {
    categoryId: cat.id,
    categorySlug: cat.slug!,
    priceId: price.id,
    productId: product.id,
    productSlug: product.slug!,
  };

  project.provide('integrationDatabaseUrl', databaseUrl);
  project.provide('integrationCatalog', catalog);

  return async () => {
    await stop();
  };
}
