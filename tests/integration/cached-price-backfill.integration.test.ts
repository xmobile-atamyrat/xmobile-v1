import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

/**
 * Exercises the cachedPrice backfill from
 * prisma/migrations/20260910120000_add_display_price_tmt.
 *
 * The migration runs against an empty database in this harness, so applying it
 * only proves the SQL parses. This re-runs the same statement over real rows —
 * safe, because it is idempotent — across every shape the Prices table holds.
 *
 * Keep this statement in step with the migration file.
 */
const BACKFILL_SQL = `
UPDATE "Product" AS p
SET "cachedPrice" = v.val
FROM (
  SELECT
    pr.id AS pid,
    CASE
      WHEN pr."displayPriceTmt" ~ '^[0-9]+(\\.[0-9]+)?$'
        AND pr."displayPriceTmt"::double precision > 0
        THEN pr."displayPriceTmt"::double precision
      WHEN pr."priceInTmt" ~ '^[0-9]+(\\.[0-9]+)?$'
        THEN pr."priceInTmt"::double precision
      ELSE NULL
    END AS val
  FROM "Prices" pr
) AS v(pid, val)
WHERE p."deletedAt" IS NULL
  AND v.val IS NOT NULL
  AND (p."price" = v.pid OR p."price" LIKE '%[' || v.pid || ']%')
`;

describe('cachedPrice migration backfill (integration)', () => {
  let prisma: PrismaClient;
  let categoryId: string;
  const slugs: string[] = [];

  const seed = async (
    slug: string,
    priceFields: { priceInTmt: string; displayPriceTmt: string | null },
    priceRef?: (priceId: string) => string,
  ) => {
    const price = await prisma.prices.create({
      data: { name: `backfill ${slug}`, price: '1', ...priceFields },
    });
    slugs.push(slug);
    return prisma.product.create({
      data: {
        slug,
        name: `{"en":"${slug}"}`,
        categoryId,
        imgUrls: [],
        tags: [],
        videoUrls: [],
        price: priceRef ? priceRef(price.id) : `[${price.id}]`,
        cachedPrice: null,
      },
    });
  };

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    categoryId = catalog.categoryId;
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    await seed('backfill-pinned', {
      priceInTmt: '1283',
      displayPriceTmt: '1290',
    });
    await seed('backfill-null-display', {
      priceInTmt: '1283',
      displayPriceTmt: null,
    });
    await seed('backfill-zero-display', {
      priceInTmt: '1283',
      displayPriceTmt: '0',
    });
    await seed('backfill-legacy-garbage', {
      priceInTmt: 'call for price',
      displayPriceTmt: null,
    });
    await seed(
      'backfill-bare-id',
      { priceInTmt: '450', displayPriceTmt: '450' },
      (priceId) => priceId,
    );

    await prisma.$executeRawUnsafe(BACKFILL_SQL);
  }, 180_000);

  afterAll(async () => {
    if (prisma != null) {
      await prisma.product.deleteMany({ where: { slug: { in: slugs } } });
      await prisma.prices.deleteMany({
        where: { name: { startsWith: 'backfill ' } },
      });
      await prisma.$disconnect();
    }
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  const cached = async (slug: string) =>
    (await prisma.product.findUnique({ where: { slug } }))?.cachedPrice;

  it('uses the pinned display price', async () => {
    expect(await cached('backfill-pinned')).toBe(1290);
  });

  it('falls back to the exact manat when no display price is stored', async () => {
    expect(await cached('backfill-null-display')).toBe(1283);
  });

  // Mirrors displayPriceOf, which treats a stored zero as "not computed"
  // rather than as a free product.
  it('treats a stored zero as unset and falls back', async () => {
    expect(await cached('backfill-zero-display')).toBe(1283);
  });

  // The regex guard earns its place here: without it this row aborts the whole
  // migration with an invalid-input-syntax error rather than being skipped.
  it('skips a price whose manat value is not a number', async () => {
    expect(await cached('backfill-legacy-garbage')).toBeNull();
  });

  it('matches the bare-id base price format as well as [id]', async () => {
    expect(await cached('backfill-bare-id')).toBe(450);
  });

  it('is idempotent', async () => {
    await prisma.$executeRawUnsafe(BACKFILL_SQL);
    expect(await cached('backfill-pinned')).toBe(1290);
    expect(await cached('backfill-null-display')).toBe(1283);
  });
});
