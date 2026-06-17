import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Colors API (integration)', () => {
  let prisma: PrismaClient;
  let adminToken: string;
  let adminUserId: string;
  let seededColorId: string;

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();

    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();

    const admin = await createStaffPrincipal(prisma, 'ADMIN');
    adminToken = admin.accessToken;
    adminUserId = admin.userId;

    const seeded = await prisma.color.create({
      data: { name: 'IntTest Seeded Blue', hex: '#0000aa' },
    });
    seededColorId = seeded.id;
  }, 180_000);

  afterAll(async () => {
    await prisma.color
      .deleteMany({ where: { name: { startsWith: 'IntTest' } } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
    await prisma.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  // ── GET (public) ───────────────────────────────────────────────────────────

  it('GET returns 200 with an array of colors', async () => {
    const handler = (await import('@/pages/api/colors/index.page')).default;
    const { req, res } = createMocks({ method: 'GET', url: '/api/colors' });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData() as string);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET with ?id=<id> returns the matching color', async () => {
    const handler = (await import('@/pages/api/colors/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/colors',
      query: { id: seededColorId },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData() as string);
    expect(body.data.id).toBe(seededColorId);
    expect(body.data.name).toBe('IntTest Seeded Blue');
  });

  it('GET with ?id={colorId} (curly-bracket prefix) resolves the color via getColor helper', async () => {
    const handler = (await import('@/pages/api/colors/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/colors',
      query: { id: `{${seededColorId}}` },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData() as string);
    expect(body.data?.id).toBe(seededColorId);
  });

  it('GET with an unknown ?id returns 200 with null data', async () => {
    const handler = (await import('@/pages/api/colors/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/colors',
      query: { id: '00000000-0000-4000-8000-000000000099' },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData() as string);
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
  });

  // ── POST ───────────────────────────────────────────────────────────────────

  it('POST without Authorization returns 401', async () => {
    const handler = (await import('@/pages/api/colors/index.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/colors',
      body: { name: 'IntTest Ghost', hex: '#aaaaaa' },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(401);
  });

  it('POST with a non-admin user token returns 401', async () => {
    const session = await signupTestUser('color-regular');
    const handler = (await import('@/pages/api/colors/index.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/colors',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: { name: 'IntTest Regular', hex: '#bbbbbb' },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(401);
    expect(JSON.parse(res._getData() as string).message).toBe('Unauthorized');
  });

  it('POST with ADMIN token and valid body creates the color', async () => {
    const handler = (await import('@/pages/api/colors/index.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/colors',
      headers: { authorization: `Bearer ${adminToken}` },
      body: { name: 'IntTest Created Green', hex: '#00cc00' },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData() as string);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('IntTest Created Green');

    const inDb = await prisma.color.findUnique({
      where: { name: 'IntTest Created Green' },
    });
    expect(inDb).not.toBeNull();
  });

  it('POST with ADMIN token but missing name returns 400', async () => {
    const handler = (await import('@/pages/api/colors/index.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/colors',
      headers: { authorization: `Bearer ${adminToken}` },
      body: { hex: '#dd0000' },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(400);
  });

  it('POST with ADMIN token but missing hex returns 400', async () => {
    const handler = (await import('@/pages/api/colors/index.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/colors',
      headers: { authorization: `Bearer ${adminToken}` },
      body: { name: 'IntTest No Hex' },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(400);
  });

  it('POST with a duplicate name returns 409 colorExists', async () => {
    const handler = (await import('@/pages/api/colors/index.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/colors',
      headers: { authorization: `Bearer ${adminToken}` },
      body: { name: 'IntTest Seeded Blue', hex: '#0000bb' },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(409);
    expect(JSON.parse(res._getData() as string).message).toBe('colorExists');
  });

  // ── PUT ────────────────────────────────────────────────────────────────────

  it('PUT with ADMIN token updates the color batch', async () => {
    const handler = (await import('@/pages/api/colors/index.page')).default;
    const { req, res } = createMocks({
      method: 'PUT',
      url: '/api/colors',
      headers: { authorization: `Bearer ${adminToken}` },
      body: {
        colorPairs: [
          {
            id: seededColorId,
            name: 'IntTest Seeded Blue Renamed',
            hex: '#0000aa',
          },
        ],
      },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData() as string).success).toBe(true);

    const updated = await prisma.color.findUnique({
      where: { id: seededColorId },
    });
    expect(updated?.name).toBe('IntTest Seeded Blue Renamed');

    // Restore the name so afterAll cleanup still works
    await prisma.color.update({
      where: { id: seededColorId },
      data: { name: 'IntTest Seeded Blue' },
    });
  });

  it('PUT with missing colorPairs body returns 400', async () => {
    const handler = (await import('@/pages/api/colors/index.page')).default;
    const { req, res } = createMocks({
      method: 'PUT',
      url: '/api/colors',
      headers: { authorization: `Bearer ${adminToken}` },
      body: {},
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(400);
  });

  // ── DELETE ─────────────────────────────────────────────────────────────────

  it('DELETE without ?id returns 400', async () => {
    const handler = (await import('@/pages/api/colors/index.page')).default;
    const { req, res } = createMocks({
      method: 'DELETE',
      url: '/api/colors',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(400);
  });

  it('DELETE with a valid ?id removes the color from the DB', async () => {
    const toDelete = await prisma.color.create({
      data: { name: 'IntTest To Delete', hex: '#eeeeee' },
    });

    const handler = (await import('@/pages/api/colors/index.page')).default;
    const { req, res } = createMocks({
      method: 'DELETE',
      url: '/api/colors',
      headers: { authorization: `Bearer ${adminToken}` },
      query: { id: toDelete.id },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);

    const gone = await prisma.color.findUnique({ where: { id: toDelete.id } });
    expect(gone).toBeNull();
  });

  // ── Method guard ───────────────────────────────────────────────────────────

  it('PATCH returns 405', async () => {
    const handler = (await import('@/pages/api/colors/index.page')).default;
    const { req, res } = createMocks({
      method: 'PATCH',
      url: '/api/colors',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(405);
  });
});
