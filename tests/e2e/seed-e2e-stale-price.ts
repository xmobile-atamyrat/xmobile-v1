import { PrismaClient } from '@prisma/client';

import { E2E_STALE } from './fixtures/stale-price';

const name = (label: string) =>
  JSON.stringify({
    tk: label,
    en: label,
    ru: label,
    ch: label,
    tr: label,
  });

// DATABASE_URL is the e2e container's: global setup exports it to workers.
async function withPrisma(run: (prisma: PrismaClient) => Promise<void>) {
  const prisma = new PrismaClient();
  try {
    await run(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

const remove = async (prisma: PrismaClient) => {
  await prisma.product.deleteMany({ where: { id: E2E_STALE.productId } });
  await prisma.prices.deleteMany({ where: { id: E2E_STALE.priceId } });
  await prisma.category.deleteMany({ where: { id: E2E_STALE.categoryId } });
};

export const removeE2eStalePrice = () => withPrisma(remove);

/**
 * One product whose price was last checked long ago, in a category of its own.
 * Created by the spec rather than global setup, and removed afterwards, so
 * other specs don't get a stale warning they didn't ask for.
 */
export const seedE2eStalePrice = () =>
  withPrisma(async (prisma) => {
    await remove(prisma); // a retry starts from a stale price again
    await prisma.category.create({
      data: {
        id: E2E_STALE.categoryId,
        name: name('E2E Stale Category'),
        slug: E2E_STALE.categorySlug,
        sortOrder: 99,
      },
    });
    await prisma.prices.create({
      data: {
        id: E2E_STALE.priceId,
        name: E2E_STALE.priceName,
        price: '100',
        priceInTmt: '1950',
        displayPriceTmt: '1950',
        priceCheckedAt: new Date(
          Date.now() - E2E_STALE.days * 24 * 60 * 60 * 1000,
        ),
      },
    });
    await prisma.product.create({
      data: {
        id: E2E_STALE.productId,
        slug: E2E_STALE.productSlug,
        name: name(E2E_STALE.productName),
        categoryId: E2E_STALE.categoryId,
        price: `[${E2E_STALE.priceId}]`,
        imgUrls: ['e2e-stale-product.webp'],
        tags: [],
        videoUrls: [],
        // Old, so it never counts as one of the newest products.
        createdAt: new Date('2020-01-01T00:00:00Z'),
      },
    });
  });
