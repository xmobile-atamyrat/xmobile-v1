import type { PrismaClient } from '@prisma/client';

import { E2E_CATALOG } from './fixtures/catalog-slugs';

const name = (label: string) =>
  JSON.stringify({
    tk: label,
    en: label,
    ru: label,
    ch: label,
    tr: label,
  });

/**
 * Minimal tree + product for navigation and listing checks.
 */
export async function seedE2eCatalog(prisma: PrismaClient): Promise<void> {
  const root = await prisma.category.create({
    data: {
      name: name(E2E_CATALOG.rootName),
      slug: E2E_CATALOG.rootSlug,
      sortOrder: 0,
      popular: true,
    },
  });

  const sub = await prisma.category.create({
    data: {
      name: name(E2E_CATALOG.subName),
      slug: E2E_CATALOG.subSlug,
      predecessorId: root.id,
      sortOrder: 0,
    },
  });

  const price = await prisma.prices.create({
    data: {
      name: 'e2e-list-price',
      price: '1',
      priceInTmt: '99.99',
    },
  });

  await prisma.product.create({
    data: {
      slug: E2E_CATALOG.productSlug,
      name: name(E2E_CATALOG.productName),
      categoryId: sub.id,
      imgUrls: [],
      tags: [],
      videoUrls: [],
      price: `[${price.id}]`,
    },
  });
}
