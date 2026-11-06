import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { createMocks, RequestMethod } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AUTH_REFRESH_COOKIE_NAME } from '@/pages/lib/constants';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { signupTestUser, TestSession } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Favorites API (integration)', () => {
  let prisma: PrismaClient;
  let productId: string;
  let categoryId: string;
  let roundedProductSlug: string;
  const createdProductIds: string[] = [];

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    productId = catalog.productId;
    categoryId = catalog.categoryId;
    roundedProductSlug = catalog.roundedProductSlug;

    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();
  }, 180_000);

  afterAll(async () => {
    // The database is shared, and these would push the seeded product off the
    // first page of newest products that later files read.
    await prisma?.product.deleteMany({
      where: { id: { in: createdProductIds } },
    });
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  async function callFavorites(
    method: RequestMethod,
    session: TestSession | null,
    options: { body?: object; query?: Record<string, string> } = {},
  ) {
    const handler = (await import('@/pages/api/favorites.page')).default;
    const { req, res } = createMocks({
      method,
      url: '/api/favorites',
      headers: session
        ? { authorization: `Bearer ${session.accessToken}` }
        : {},
      ...options,
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    return { status: res._getStatusCode(), json: res._getJSONData() };
  }

  const addFavorite = (session: TestSession, id: string) =>
    callFavorites('POST', session, { body: { productId: id } });

  const favoriteIds = async (session: TestSession): Promise<string[]> =>
    (await callFavorites('GET', session, { query: { ids: '1' } })).json.data;

  async function createProduct(slug: string) {
    const product = await prisma.product.create({
      data: {
        slug: `${slug}-${Date.now()}`,
        name: `{"en":"${slug}"}`,
        categoryId,
        imgUrls: [],
        tags: [],
        videoUrls: [],
      },
    });
    createdProductIds.push(product.id);
    return product;
  }

  it('returns 401 when Authorization is missing', async () => {
    const { status } = await callFavorites('GET', null);
    expect(status).toBe(401);
  });

  it('adding a product twice keeps one favorite', async () => {
    const session = await signupTestUser('fav-add');

    expect((await addFavorite(session, productId)).status).toBe(200);
    expect((await addFavorite(session, productId)).status).toBe(200);

    expect(await favoriteIds(session)).toEqual([productId]);
  });

  it('removes a favorite, and removing one that is not there is not an error', async () => {
    const session = await signupTestUser('fav-remove');
    await addFavorite(session, productId);

    const removed = await callFavorites('DELETE', session, {
      body: { productId },
    });
    const removedAgain = await callFavorites('DELETE', session, {
      body: { productId },
    });

    expect(removed.status).toBe(200);
    expect(removedAgain.status).toBe(200);
    expect(await favoriteIds(session)).toEqual([]);
  });

  it('rejects a request without a productId', async () => {
    const session = await signupTestUser('fav-invalid');

    expect((await callFavorites('POST', session, { body: {} })).status).toBe(
      400,
    );
    expect((await callFavorites('DELETE', session, { body: {} })).status).toBe(
      400,
    );
  });

  it('returns 404 for a product that does not exist', async () => {
    const session = await signupTestUser('fav-missing');

    const { status } = await addFavorite(session, 'no-such-product');

    expect(status).toBe(404);
  });

  it('returns 404 for a soft-deleted product', async () => {
    const session = await signupTestUser('fav-deleted');
    const product = await createProduct('fav-deleted');
    await prisma.product.update({
      where: { id: product.id },
      data: { deletedAt: new Date() },
    });

    const { status } = await addFavorite(session, product.id);

    expect(status).toBe(404);
    expect(await favoriteIds(session)).toEqual([]);
  });

  it('lists products priced and localized, so cards need no extra requests', async () => {
    const session = await signupTestUser('fav-list');
    const rounded = await prisma.product.findUniqueOrThrow({
      where: { slug: roundedProductSlug },
    });
    await addFavorite(session, rounded.id);

    const { status, json } = await callFavorites('GET', session, {
      query: { locale: 'en' },
    });

    expect(status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe(rounded.id);
    expect(json.data[0].name).toBe('Integration rounded phone');
    expect(json.data[0].price).toBe(`${rounded.price}{1290}`);
  });

  it('keeps raw multi-locale names when no locale is given', async () => {
    const session = await signupTestUser('fav-raw');
    await addFavorite(session, productId);

    const { json } = await callFavorites('GET', session);

    expect(json.data[0].name).toBe('{"en":"Integration phone"}');
  });

  it('leaves a product with a literal price as stored', async () => {
    const session = await signupTestUser('fav-literal');
    const product = await createProduct('fav-literal');
    await prisma.product.update({
      where: { id: product.id },
      data: { price: '150' },
    });
    await addFavorite(session, product.id);

    const { json } = await callFavorites('GET', session);

    expect(json.data[0].price).toBe('150');
  });

  it('hides a soft-deleted favorite and brings it back on restore', async () => {
    const session = await signupTestUser('fav-restore');
    const product = await createProduct('fav-restore');
    await addFavorite(session, product.id);

    await prisma.product.update({
      where: { id: product.id },
      data: { deletedAt: new Date() },
    });
    const whileDeleted = await callFavorites('GET', session);
    const idsWhileDeleted = await favoriteIds(session);

    await prisma.product.update({
      where: { id: product.id },
      data: { deletedAt: null },
    });

    expect(whileDeleted.json.data).toEqual([]);
    expect(idsWhileDeleted).toEqual([]);
    expect(await favoriteIds(session)).toEqual([product.id]);
  });

  it('keeps an out-of-stock favorite in the list', async () => {
    const session = await signupTestUser('fav-oos');
    const product = await createProduct('fav-oos');
    await addFavorite(session, product.id);
    await prisma.product.update({
      where: { id: product.id },
      data: { outOfStockAt: new Date() },
    });

    const { json } = await callFavorites('GET', session);

    expect(json.data.map((item: { id: string }) => item.id)).toEqual([
      product.id,
    ]);
  });

  it('lists sold-out favorites last, newest first within each group', async () => {
    const session = await signupTestUser('fav-order');
    const older = await createProduct('fav-order-older');
    const newer = await createProduct('fav-order-newer');
    const soldOut = await createProduct('fav-order-sold-out');
    await prisma.product.update({
      where: { id: soldOut.id },
      data: { outOfStockAt: new Date() },
    });
    await addFavorite(session, soldOut.id);
    await addFavorite(session, older.id);
    await addFavorite(session, newer.id);

    const { json } = await callFavorites('GET', session);

    expect(json.data.map((item: { id: string }) => item.id)).toEqual([
      newer.id,
      older.id,
      soldOut.id,
    ]);
  });

  it('sends color ids, which the page filters by', async () => {
    const session = await signupTestUser('fav-colors');
    const color = await prisma.color.create({
      data: { name: 'Fav black', hex: '#000000' },
    });
    const product = await createProduct('fav-colors');
    await prisma.product.update({
      where: { id: product.id },
      data: { colors: { connect: { id: color.id } } },
    });
    await addFavorite(session, product.id);

    const { json } = await callFavorites('GET', session);

    expect(json.data[0].colors).toEqual([{ id: color.id }]);
  });

  it('leaves the description out of the list, which cards never show', async () => {
    const session = await signupTestUser('fav-description');
    const product = await createProduct('fav-description');
    await prisma.product.update({
      where: { id: product.id },
      data: { description: '{"en":"A long description"}' },
    });
    await addFavorite(session, product.id);

    const raw = await callFavorites('GET', session);
    const localized = await callFavorites('GET', session, {
      query: { locale: 'en' },
    });

    expect(raw.json.data[0].description).toBeNull();
    expect(localized.json.data[0].description).toBeNull();
  });

  it("does not show or change another user's favorites", async () => {
    const owner = await signupTestUser('fav-owner');
    const other = await signupTestUser('fav-other');
    await addFavorite(owner, productId);

    await callFavorites('DELETE', other, { body: { productId } });

    expect(await favoriteIds(other)).toEqual([]);
    expect(await favoriteIds(owner)).toEqual([productId]);
  });

  it('returns 405 for an unsupported method', async () => {
    const session = await signupTestUser('fav-method');

    const { status } = await callFavorites('PUT', session);

    expect(status).toBe(405);
  });

  it('sends active favorite ids with the session, sparing a separate request', async () => {
    const session = await signupTestUser('fav-session');
    const deleted = await createProduct('fav-session-deleted');
    await addFavorite(session, productId);
    await addFavorite(session, deleted.id);
    await prisma.product.update({
      where: { id: deleted.id },
      data: { deletedAt: new Date() },
    });

    const userHandler = (await import('@/pages/api/user/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/user',
      cookies: { [AUTH_REFRESH_COOKIE_NAME]: session.refreshToken },
    });
    await userHandler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData().data.favoriteProductIds).toEqual([productId]);
  });
});
