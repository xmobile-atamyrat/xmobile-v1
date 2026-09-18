import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Public catalog & health API (integration)', () => {
  let productId: string;
  let productSlug: string;
  let categoryId: string;
  let categorySlug: string;
  let priceId: string;
  let roundedProductSlug: string;

  beforeAll(async () => {
    const { catalog } = await prepareIntegrationWorker();
    productId = catalog.productId;
    productSlug = catalog.productSlug;
    categoryId = catalog.categoryId;
    categorySlug = catalog.categorySlug;
    priceId = catalog.priceId;
    roundedProductSlug = catalog.roundedProductSlug;
  }, 180_000);

  afterAll(async () => {
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('GET /api/ping returns pong', async () => {
    const ping = (await import('@/pages/api/ping.page')).default;
    const { req, res } = createMocks({ method: 'GET', url: '/api/ping' });
    await ping(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData() as string).message).toBe('pong');
  });

  it('GET /api/category returns nested tree including seeded root', async () => {
    const category = (await import('@/pages/api/category.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/category',
      query: {},
    });
    await category(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.success).toBe(true);
    const ids = (json.data as { id: string }[]).map((c) => c.id);
    expect(ids).toContain(categoryId);
  });

  it('GET /api/category?categoryId returns single category with products', async () => {
    const category = (await import('@/pages/api/category.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/category',
      query: { categoryId },
    });
    await category(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.data.id).toBe(categoryId);
    const productIds = (json.data.products as { id: string }[]).map(
      (p) => p.id,
    );
    expect(productIds).toContain(productId);
  });

  it('GET /api/category?categorySlug returns single category with products', async () => {
    const category = (await import('@/pages/api/category.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/category',
      query: { categorySlug },
    });
    await category(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.data.slug).toBe(categorySlug);
    const productIds = (json.data.products as { id: string }[]).map(
      (p) => p.id,
    );
    expect(productIds).toContain(productId);
  });

  it('GET /api/product?productId returns product with resolved price suffix', async () => {
    const session = await signupTestUser('shop');
    const product = (await import('@/pages/api/product/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/product',
      query: { productId },
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    await product(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(productId);
    expect(String(json.data.price)).toContain('{99.99}');
  });

  it('GET /api/product?productSlug returns product with resolved price suffix', async () => {
    const session = await signupTestUser('shop-slug');
    const product = (await import('@/pages/api/product/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/product',
      query: { productSlug },
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    await product(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.success).toBe(true);
    expect(json.data.slug).toBe(productSlug);
    expect(String(json.data.price)).toContain('{99.99}');
  });

  // The seeded price stores 1283 exact / 1290 shown, so this proves the
  // decoration the product card renders carries the rounded figure.
  it('GET /api/product?productSlug decorates with the rounded display price', async () => {
    const session = await signupTestUser('shop-rounded');
    const product = (await import('@/pages/api/product/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/product',
      query: { productSlug: roundedProductSlug },
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    await product(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.success).toBe(true);
    expect(String(json.data.price)).toContain('{1290}');
    expect(String(json.data.price)).not.toContain('1283');
  });

  it('GET /api/product rejects invalid productId format', async () => {
    const session = await signupTestUser('badid');
    const product = (await import('@/pages/api/product/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/product',
      query: { productId: 'not-valid!!!' },
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    await product(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData() as string).success).toBe(false);
  });

  it('GET /api/product?categoryId lists seeded product in first page', async () => {
    const session = await signupTestUser('list');
    const product = (await import('@/pages/api/product/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/product',
      query: { categoryId, page: '1' },
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    await product(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.success).toBe(true);
    const list = json.data as { id: string }[];
    expect(list.some((p) => p.id === productId)).toBe(true);
  });

  // Seeded at 1283 exact / 1290 shown, so these ranges straddle the gap: a
  // filter matching on the exact manat gets both of them wrong.
  it('GET /api/product?minPrice filters on the shown price, not the exact one', async () => {
    const session = await signupTestUser('filter-min');
    const product = (await import('@/pages/api/product/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/product',
      query: { categoryId, page: '1', minPrice: '1285', maxPrice: '1295' },
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    await product(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.success).toBe(true);
    const list = json.data as { slug: string }[];
    // 1290 is inside [1285, 1295]; 1283 would not have been.
    expect(list.some((p) => p.slug === roundedProductSlug)).toBe(true);
  });

  it('GET /api/product?maxPrice excludes a product whose shown price is above it', async () => {
    const session = await signupTestUser('filter-max');
    const product = (await import('@/pages/api/product/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/product',
      query: { categoryId, page: '1', maxPrice: '1285' },
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    await product(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    const list = json.data as { slug: string }[];
    // Shown at 1290, so it is out — even though its exact manat is 1283.
    expect(list.some((p) => p.slug === roundedProductSlug)).toBe(false);
  });

  it('GET /api/app-version returns semver defaults when no row exists', async () => {
    const handler = (await import('@/pages/api/app-version.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/app-version',
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.hardMinVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(json.softMinVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('GET /api/brand lists brands without auth (bypass)', async () => {
    const brand = (await import('@/pages/api/brand/index.page')).default;
    const { req, res } = createMocks({ method: 'GET', url: '/api/brand' });
    await brand(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('GET /api/prices lists all prices without auth (bypass)', async () => {
    const prices = (await import('@/pages/api/prices/index.page')).default;
    const { req, res } = createMocks({ method: 'GET', url: '/api/prices' });
    await prices(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.success).toBe(true);
    const rows = json.data as { id: string }[];
    expect(rows.some((r) => r.id === priceId)).toBe(true);
  });

  it('GET /api/prices?id resolves bracket price id', async () => {
    const prices = (await import('@/pages/api/prices/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/prices',
      query: { id: `[${priceId}]` },
    });
    await prices(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.data?.id).toBe(priceId);
  });

  it('GET /api/prices/rate returns rate list or empty', async () => {
    const rate = (await import('@/pages/api/prices/rate.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/prices/rate',
    });
    await rate(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('GET /api/prices/rate rejects unknown currency', async () => {
    const rate = (await import('@/pages/api/prices/rate.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/prices/rate',
      query: { currency: 'INVALID' },
    });
    await rate(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(400);
  });
});
