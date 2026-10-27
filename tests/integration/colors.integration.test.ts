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
  let brandAId: string;
  let brandBId: string;

  const callColors = async (
    method: 'POST' | 'PUT',
    body: Record<string, unknown>,
  ) => {
    const handler = (await import('@/pages/api/colors/index.page')).default;
    const { req, res } = createMocks({
      method,
      url: '/api/colors',
      headers: { authorization: `Bearer ${adminToken}` },
      body,
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    return {
      status: res._getStatusCode(),
      body: JSON.parse(res._getData() as string),
    };
  };

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

    const brandA = await prisma.brand.create({
      data: { name: 'IntTest Brand A' },
    });
    const brandB = await prisma.brand.create({
      data: { name: 'IntTest Brand B' },
    });
    brandAId = brandA.id;
    brandBId = brandB.id;
  }, 180_000);

  afterAll(async () => {
    await prisma.color
      .deleteMany({ where: { name: { startsWith: 'IntTest' } } })
      .catch(() => {});
    await prisma.brand
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

    const inDb = await prisma.color.findFirst({
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

  // ── Brands ─────────────────────────────────────────────────────────────────

  it('POST with a brandId stores the brand on the color', async () => {
    const { status, body } = await callColors('POST', {
      name: 'IntTest Brand Black',
      hex: '#010101',
      brandId: brandAId,
    });
    expect(status).toBe(200);
    expect(body.data.brandId).toBe(brandAId);
  });

  it('POST allows the same name and hex under a different brand', async () => {
    const { status, body } = await callColors('POST', {
      name: 'IntTest Brand Black',
      hex: '#010101',
      brandId: brandBId,
    });
    expect(status).toBe(200);
    expect(body.data.brandId).toBe(brandBId);
  });

  it('POST rejects a duplicate name within the same brand', async () => {
    const { status, body } = await callColors('POST', {
      name: 'IntTest Brand Black',
      hex: '#020202',
      brandId: brandAId,
    });
    expect(status).toBe(409);
    expect(body.message).toBe('colorExists');
  });

  it('POST rejects a duplicate hex within the same brand', async () => {
    const { status, body } = await callColors('POST', {
      name: 'IntTest Brand Other',
      hex: '#010101',
      brandId: brandAId,
    });
    expect(status).toBe(409);
    expect(body.message).toBe('colorExists');
  });

  it('POST rejects a duplicate hex among unbranded colors', async () => {
    const { status, body } = await callColors('POST', {
      name: 'IntTest Unbranded Other',
      hex: '#0000aa',
    });
    expect(status).toBe(409);
    expect(body.message).toBe('colorExists');
  });

  it('POST treats an empty brandId as no brand', async () => {
    const { status, body } = await callColors('POST', {
      name: 'IntTest Seeded Blue',
      hex: '#0000cc',
      brandId: '',
    });
    expect(status).toBe(409);
    expect(body.message).toBe('colorExists');
  });

  it('POST with an unknown brandId returns 400 brandNotFound', async () => {
    const { status, body } = await callColors('POST', {
      name: 'IntTest Ghost Brand',
      hex: '#030303',
      brandId: '00000000-0000-4000-8000-000000000098',
    });
    expect(status).toBe(400);
    expect(body.message).toBe('brandNotFound');
  });

  it('PUT moves a color to a brand and back to no brand', async () => {
    const color = await prisma.color.create({
      data: { name: 'IntTest Movable', hex: '#040404' },
    });

    const toBrand = await callColors('PUT', {
      colorPairs: [{ id: color.id, brandId: brandAId }],
    });
    expect(toBrand.status).toBe(200);
    const branded = await prisma.color.findUnique({ where: { id: color.id } });
    expect(branded?.brandId).toBe(brandAId);

    const toNone = await callColors('PUT', {
      colorPairs: [{ id: color.id, brandId: null }],
    });
    expect(toNone.status).toBe(200);
    const after = await prisma.color.findUnique({ where: { id: color.id } });
    expect(after?.brandId).toBeNull();
    expect(after?.name).toBe('IntTest Movable');
  });

  it('PUT leaves the brand alone when brandId is omitted', async () => {
    const color = await prisma.color.create({
      data: { name: 'IntTest Keep Brand', hex: '#050505', brandId: brandBId },
    });
    const { status } = await callColors('PUT', {
      colorPairs: [{ id: color.id, name: 'IntTest Keep Brand Renamed' }],
    });
    expect(status).toBe(200);
    const after = await prisma.color.findUnique({ where: { id: color.id } });
    expect(after?.brandId).toBe(brandBId);
    expect(after?.name).toBe('IntTest Keep Brand Renamed');
  });

  it('PUT rejects moving a color into a brand that already has its name', async () => {
    const color = await prisma.color.create({
      data: { name: 'IntTest Brand Black', hex: '#060606' },
    });
    const { status, body } = await callColors('PUT', {
      colorPairs: [{ id: color.id, brandId: brandAId }],
    });
    expect(status).toBe(409);
    expect(body.message).toBe('colorExists');
    const after = await prisma.color.findUnique({ where: { id: color.id } });
    expect(after?.brandId).toBeNull();
  });

  it('PUT rejects unbranding a color whose name an unbranded color already has', async () => {
    const color = await prisma.color.create({
      data: { name: 'IntTest Seeded Blue', hex: '#070707', brandId: brandAId },
    });
    const { status, body } = await callColors('PUT', {
      colorPairs: [{ id: color.id, brandId: null }],
    });
    expect(status).toBe(409);
    expect(body.message).toBe('colorExists');
  });

  it('PUT rejects a batch that collides with itself', async () => {
    const one = await prisma.color.create({
      data: { name: 'IntTest Batch One', hex: '#080808', brandId: brandBId },
    });
    const two = await prisma.color.create({
      data: { name: 'IntTest Batch Two', hex: '#090909', brandId: brandBId },
    });
    const { status } = await callColors('PUT', {
      colorPairs: [
        { id: one.id, name: 'IntTest Batch Same' },
        { id: two.id, name: 'IntTest Batch Same' },
      ],
    });
    expect(status).toBe(409);
    const after = await prisma.color.findUnique({ where: { id: one.id } });
    expect(after?.name).toBe('IntTest Batch One');
  });

  it('PUT merges repeated entries for the same color, later fields winning', async () => {
    const color = await prisma.color.create({
      data: { name: 'IntTest Repeated', hex: '#0a0a0a', brandId: brandBId },
    });
    const { status } = await callColors('PUT', {
      colorPairs: [
        { id: color.id, name: 'IntTest Repeated First' },
        { id: color.id, hex: '#0b0b0b' },
        { id: color.id, name: 'IntTest Repeated Last' },
      ],
    });
    expect(status).toBe(200);
    const after = await prisma.color.findUnique({ where: { id: color.id } });
    expect(after?.name).toBe('IntTest Repeated Last');
    expect(after?.hex).toBe('#0b0b0b');
  });

  it('concurrent unbranded POSTs create only one color', async () => {
    const results = await Promise.all([
      callColors('POST', { name: 'IntTest Racing Red', hex: '#0c0c0c' }),
      callColors('POST', { name: 'IntTest Racing Red', hex: '#0c0c0c' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const count = await prisma.color.count({
      where: { name: 'IntTest Racing Red' },
    });
    expect(count).toBe(1);
  });

  it('PUT with a deleted color id returns 404 colorNotFound and changes nothing', async () => {
    const color = await prisma.color.create({
      data: { name: 'IntTest Survivor', hex: '#0d0d0d', brandId: brandBId },
    });
    const { status, body } = await callColors('PUT', {
      colorPairs: [
        { id: color.id, name: 'IntTest Survivor Renamed' },
        { id: '00000000-0000-4000-8000-000000000097', name: 'IntTest Ghost' },
      ],
    });
    expect(status).toBe(404);
    expect(body.message).toBe('colorNotFound');
    const after = await prisma.color.findUnique({ where: { id: color.id } });
    expect(after?.name).toBe('IntTest Survivor');
  });

  it('deleting a brand whose color clashes with an unbranded one returns 409', async () => {
    const brand = await prisma.brand.create({
      data: { name: 'IntTest Brand Clashing' },
    });
    const color = await prisma.color.create({
      data: { name: 'IntTest Seeded Blue', hex: '#0e0e0e', brandId: brand.id },
    });
    const handler = (await import('@/pages/api/brand/index.page')).default;
    const { req, res } = createMocks({
      method: 'DELETE',
      url: `/api/brand?id=${brand.id}`,
      query: { id: brand.id },
      headers: { authorization: `Bearer ${adminToken}` },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(409);
    expect(JSON.parse(res._getData() as string).message).toBe(
      'brandColorsClash',
    );
    const after = await prisma.color.findUnique({ where: { id: color.id } });
    expect(after?.brandId).toBe(brand.id);
  });

  it('deleting a brand leaves its colors unbranded', async () => {
    const brand = await prisma.brand.create({
      data: { name: 'IntTest Brand Doomed' },
    });
    const color = await prisma.color.create({
      data: { name: 'IntTest Orphan', hex: '#0a0a0a', brandId: brand.id },
    });
    await prisma.brand.delete({ where: { id: brand.id } });
    const after = await prisma.color.findUnique({ where: { id: color.id } });
    expect(after).not.toBeNull();
    expect(after?.brandId).toBeNull();
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
