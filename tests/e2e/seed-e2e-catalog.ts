import type { PrismaClient } from '@prisma/client';

import { E2E_CATALOG, E2E_VARIANT_PRODUCT } from './fixtures/catalog-slugs';

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
      id: E2E_CATALOG.rootUuid,
      name: name(E2E_CATALOG.rootName),
      slug: E2E_CATALOG.rootSlug,
      sortOrder: 0,
      popular: true,
    },
  });

  const sub = await prisma.category.create({
    data: {
      id: E2E_CATALOG.subUuid,
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
      id: E2E_CATALOG.productUuid,
      slug: E2E_CATALOG.productSlug,
      name: name(E2E_CATALOG.productName),
      categoryId: sub.id,
      imgUrls: [],
      tags: [],
      videoUrls: [],
      price: `[${price.id}]`,
    },
  });

  // ── Variant product ────────────────────────────────────────────────────────
  const variantColor = await prisma.color.create({
    data: {
      id: E2E_VARIANT_PRODUCT.colorUuid,
      name: E2E_VARIANT_PRODUCT.colorName,
      hex: E2E_VARIANT_PRODUCT.colorHex,
    },
  });

  const variantPrice = await prisma.prices.create({
    data: {
      name: 'e2e-variant-price',
      price: '2',
      priceInTmt: '149.99',
    },
  });

  await prisma.product.create({
    data: {
      id: E2E_VARIANT_PRODUCT.uuid,
      slug: E2E_VARIANT_PRODUCT.slug,
      name: name(E2E_VARIANT_PRODUCT.name),
      categoryId: sub.id,
      imgUrls: [],
      videoUrls: [],
      tags: [
        `${E2E_VARIANT_PRODUCT.specText} [${variantPrice.id}]{${variantColor.id}}`,
      ],
      price: `[${variantPrice.id}]`,
      colors: { connect: [{ id: variantColor.id }] },
    },
  });
}
