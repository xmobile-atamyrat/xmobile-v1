import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, UserRole } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Role-gated API routes (integration)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();
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

  it('POST /api/brand returns 401 for FREE user', async () => {
    const session = await signupTestUser('brand-free');
    const brand = (await import('@/pages/api/brand/index.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/brand',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: { name: `Brand-${Date.now()}` },
    });
    await brand(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(401);
  });

  it('POST /api/brand succeeds for ADMIN and duplicate name returns 400', async () => {
    const admin = await prisma.user.create({
      data: {
        email: `admin-brand-${Date.now()}@test.local`,
        name: 'Admin',
        password: 'placeholder',
        grade: UserRole.ADMIN,
      },
    });

    const { generateTokens } = await import('@/pages/api/utils/tokenUtils');
    const { accessToken } = generateTokens(admin.id, UserRole.ADMIN);
    const brandName = `IntBrand-${Date.now()}`;

    const brand = (await import('@/pages/api/brand/index.page')).default;
    const create = createMocks({
      method: 'POST',
      url: '/api/brand',
      headers: { authorization: `Bearer ${accessToken}` },
      body: { name: brandName },
    });
    await brand(
      create.req as unknown as NextApiRequest,
      create.res as unknown as NextApiResponse,
    );
    expect(create.res._getStatusCode()).toBe(201);
    const created = JSON.parse(create.res._getData() as string).data;

    const dup = createMocks({
      method: 'POST',
      url: '/api/brand',
      headers: { authorization: `Bearer ${accessToken}` },
      body: { name: brandName },
    });
    await brand(
      dup.req as unknown as NextApiRequest,
      dup.res as unknown as NextApiResponse,
    );
    expect(dup.res._getStatusCode()).toBe(400);

    const del = createMocks({
      method: 'DELETE',
      url: '/api/brand',
      headers: { authorization: `Bearer ${accessToken}` },
      query: { id: created.id },
    });
    await brand(
      del.req as unknown as NextApiRequest,
      del.res as unknown as NextApiResponse,
    );
    expect(del.res._getStatusCode()).toBe(200);

    await prisma.user.delete({ where: { id: admin.id } });
  });

  it('PUT /api/app-version returns 403 for non-superuser', async () => {
    const session = await signupTestUser('app-ver');
    const handler = (await import('@/pages/api/app-version.page')).default;
    const { req, res } = createMocks({
      method: 'PUT',
      url: '/api/app-version',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: { hardMinVersion: '1.0.0', softMinVersion: '1.0.1' },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(403);
  });

  it('PUT /api/app-version succeeds for SUPERUSER', async () => {
    const su = await prisma.user.create({
      data: {
        email: `su-${Date.now()}@test.local`,
        name: 'SU',
        password: 'placeholder',
        grade: UserRole.SUPERUSER,
      },
    });
    const { generateTokens } = await import('@/pages/api/utils/tokenUtils');
    const { accessToken } = generateTokens(su.id, UserRole.SUPERUSER);

    const handler = (await import('@/pages/api/app-version.page')).default;
    const { req, res } = createMocks({
      method: 'PUT',
      url: '/api/app-version',
      headers: { authorization: `Bearer ${accessToken}` },
      body: { hardMinVersion: '2.0.0', softMinVersion: '2.0.1' },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);

    await prisma.user.delete({ where: { id: su.id } });
  });

  it('POST /api/prices returns 401 for FREE user', async () => {
    const session = await signupTestUser('price-free');
    const prices = (await import('@/pages/api/prices/index.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/prices',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: { name: 'X', price: '1', priceInTmt: '1' },
    });
    await prices(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(401);
  });

  it('POST /api/prices succeeds for ADMIN and DELETE cleans up', async () => {
    const admin = await prisma.user.create({
      data: {
        email: `admin-price-${Date.now()}@test.local`,
        name: 'Admin',
        password: 'placeholder',
        grade: UserRole.ADMIN,
      },
    });
    const { generateTokens } = await import('@/pages/api/utils/tokenUtils');
    const { accessToken } = generateTokens(admin.id, UserRole.ADMIN);
    const prices = (await import('@/pages/api/prices/index.page')).default;
    const auth = { authorization: `Bearer ${accessToken}` };
    const name = `PriceRow-${Date.now()}`;

    const post = createMocks({
      method: 'POST',
      url: '/api/prices',
      headers: auth,
      body: { name, price: '2', priceInTmt: '20' },
    });
    await prices(
      post.req as unknown as NextApiRequest,
      post.res as unknown as NextApiResponse,
    );
    expect(post.res._getStatusCode()).toBe(200);
    const row = JSON.parse(post.res._getData() as string).data as {
      id: string;
    };

    const del = createMocks({
      method: 'DELETE',
      url: '/api/prices',
      headers: auth,
      query: { id: row.id },
    });
    await prices(
      del.req as unknown as NextApiRequest,
      del.res as unknown as NextApiResponse,
    );
    expect(del.res._getStatusCode()).toBe(200);

    await prisma.user.delete({ where: { id: admin.id } });
  });

  it('PUT /api/brand updates name for ADMIN', async () => {
    const admin = await prisma.user.create({
      data: {
        email: `admin-brand-put-${Date.now()}@test.local`,
        name: 'Admin',
        password: 'placeholder',
        grade: UserRole.ADMIN,
      },
    });
    const { generateTokens } = await import('@/pages/api/utils/tokenUtils');
    const { accessToken } = generateTokens(admin.id, UserRole.ADMIN);
    const brand = (await import('@/pages/api/brand/index.page')).default;
    const auth = { authorization: `Bearer ${accessToken}` };
    const base = `BrandPut-${Date.now()}`;

    const post = createMocks({
      method: 'POST',
      url: '/api/brand',
      headers: auth,
      body: { name: base },
    });
    await brand(
      post.req as unknown as NextApiRequest,
      post.res as unknown as NextApiResponse,
    );
    const created = JSON.parse(post.res._getData() as string).data as {
      id: string;
    };

    const put = createMocks({
      method: 'PUT',
      url: '/api/brand',
      headers: auth,
      body: { id: created.id, name: `${base}-renamed` },
    });
    await brand(
      put.req as unknown as NextApiRequest,
      put.res as unknown as NextApiResponse,
    );
    expect(put.res._getStatusCode()).toBe(200);

    const del = createMocks({
      method: 'DELETE',
      url: '/api/brand',
      headers: auth,
      query: { id: created.id },
    });
    await brand(
      del.req as unknown as NextApiRequest,
      del.res as unknown as NextApiResponse,
    );

    await prisma.user.delete({ where: { id: admin.id } });
  });
});
