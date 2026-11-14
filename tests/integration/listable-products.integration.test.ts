import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { createMocks, RequestMethod } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown;

async function call(
  load: () => Promise<{ default: Handler }>,
  url: string,
  options: {
    method?: RequestMethod;
    query?: Record<string, string>;
    body?: object;
    token?: string;
  } = {},
) {
  const handler = (await load()).default;
  const { req, res } = createMocks({
    method: options.method ?? 'GET',
    url,
    query: options.query ?? {},
    body: options.body,
    headers: options.token ? { authorization: `Bearer ${options.token}` } : {},
  });
  await handler(
    req as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  );
  return { status: res._getStatusCode(), json: res._getJSONData() };
}

const productApi = () => import('@/pages/api/product/index.page');

describe('Products without images (integration)', () => {
  let prisma: PrismaClient;
  let categoryId: string;
  let brandId: string;
  let withImageId: string;
  let noImageId: string;
  let noImageSlug: string;

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    const stamp = Date.now();
    const category = await prisma.category.create({
      data: { name: '{"en":"Listable"}', slug: `listable-${stamp}` },
    });
    categoryId = category.id;
    brandId = (
      await prisma.brand.create({ data: { name: `Listable brand ${stamp}` } })
    ).id;

    const product = (slug: string, imgUrls: string[]) =>
      prisma.product.create({
        data: {
          slug: `${slug}-${stamp}`,
          name: `{"en":"${slug}"}`,
          categoryId,
          brandId,
          imgUrls,
          tags: [],
          videoUrls: [],
          cachedPrice: 10,
        },
      });
    withImageId = (await product('listable-photo', ['/media/listable.webp']))
      .id;
    const noImage = await product('listable-no-photo', []);
    noImageId = noImage.id;
    noImageSlug = noImage.slug!;
  }, 180_000);

  afterAll(async () => {
    // Shared database: newer products would push the seeded one off the
    // first page that later files read.
    await prisma?.product.deleteMany({ where: { categoryId } });
    await prisma?.category.deleteMany({ where: { id: categoryId } });
    await prisma?.brand.deleteMany({ where: { id: brandId } });
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('leaves them out of the catalog, its count and its category facets', async () => {
    const list = await call(productApi, '/api/product', {
      query: { categoryId },
    });
    expect(list.json.data.map(({ id }: { id: string }) => id)).toEqual([
      withImageId,
    ]);

    const count = await call(productApi, '/api/product', {
      query: { categoryId, count: 'true' },
    });
    expect(count.json.data).toBe(1);

    const facets = await call(productApi, '/api/product', {
      query: { categoryId, facets: 'categories' },
    });
    expect(facets.json.data).toEqual([{ categoryId, count: 1 }]);
  });

  it('leaves them out of the filter counts', async () => {
    const { json } = await call(
      () => import('@/pages/api/product/filters.page'),
      '/api/product/filters',
      { query: { categoryId } },
    );
    expect(json.data.total).toBe(1);
    expect(json.data.brandCounts).toEqual({ [brandId]: 1 });
  });

  it('leaves them out of new products', async () => {
    const { json } = await call(
      () => import('@/pages/api/product/new.page'),
      '/api/product/new',
    );
    const ids = json.data.map(({ id }: { id: string }) => id);
    expect(ids).toContain(withImageId);
    expect(ids).not.toContain(noImageId);
  });

  it('still opens them at their own URL', async () => {
    const { status, json } = await call(productApi, '/api/product', {
      query: { productSlug: noImageSlug },
    });
    expect(status).toBe(200);
    expect(json.data.id).toBe(noImageId);
  });

  it('drops them from the favorites list but keeps the heart', async () => {
    const session = await signupTestUser('listable-fav');
    const favorites = () => import('@/pages/api/favorites.page');
    await Promise.all(
      [withImageId, noImageId].map((productId) =>
        call(favorites, '/api/favorites', {
          method: 'POST',
          body: { productId },
          token: session.accessToken,
        }),
      ),
    );

    const list = await call(favorites, '/api/favorites', {
      token: session.accessToken,
    });
    expect(list.json.data.map(({ id }: { id: string }) => id)).toEqual([
      withImageId,
    ]);

    const ids = await call(favorites, '/api/favorites', {
      query: { ids: '1' },
      token: session.accessToken,
    });
    expect([...ids.json.data].sort()).toEqual([withImageId, noImageId].sort());
  });
});
