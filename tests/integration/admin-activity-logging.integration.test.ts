import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Admin activity logging (integration)', () => {
  let prisma: PrismaClient;
  let adminToken: string;
  let adminUserId: string;
  let adminName: string;

  const call = async (
    modulePath: string,
    options: Parameters<typeof createMocks>[0],
  ) => {
    const handler = (await import(modulePath)).default;
    const { req, res } = createMocks({
      ...options,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    return { status: res._getStatusCode(), body: JSON.parse(res._getData()) };
  };

  const activityFor = (entity: string, action: string, targetId: string) =>
    vi.waitFor(
      async () => {
        const rows = await prisma.adminActivity.findMany({
          where: {
            userId: adminUserId,
            entity: entity as never,
            action: action as never,
            targetId,
          },
        });
        expect(rows).toHaveLength(1);
        return rows[0];
      },
      { timeout: 5000, interval: 100 },
    );

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    const admin = await createStaffPrincipal(prisma, 'ADMIN');
    adminToken = admin.accessToken;
    adminUserId = admin.userId;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: adminUserId },
    });
    adminName = user.name;
  }, 180_000);

  afterAll(async () => {
    await prisma.adminActivity.deleteMany({ where: { userName: adminName } });
    await prisma.color
      .deleteMany({ where: { name: { startsWith: 'ActLog' } } })
      .catch(() => {});
    await prisma.brand
      .deleteMany({ where: { name: { startsWith: 'ActLog' } } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
    await prisma.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('records color create, update and delete with the actor name', async () => {
    const created = await call('@/pages/api/colors/index.page', {
      method: 'POST',
      url: '/api/colors',
      body: { name: 'ActLog Teal', hex: '#008080' },
    });
    expect(created.status).toBe(200);
    const colorId = created.body.data.id as string;

    const createRow = await activityFor('COLOR', 'CREATE', colorId);
    expect(createRow.userName).toBe(adminName);
    expect(createRow.meta).toEqual({ name: 'ActLog Teal', hex: '#008080' });

    await call('@/pages/api/colors/index.page', {
      method: 'PUT',
      url: '/api/colors',
      body: { colorPairs: [{ id: colorId, hex: '#009999' }] },
    });
    const updateRow = await activityFor('COLOR', 'UPDATE', colorId);
    expect(updateRow.meta).toEqual({
      name: 'ActLog Teal',
      changes: { hex: { from: '#008080', to: '#009999' } },
    });

    await call('@/pages/api/colors/index.page', {
      method: 'DELETE',
      url: '/api/colors',
      query: { id: colorId },
    });
    const deleteRow = await activityFor('COLOR', 'DELETE', colorId);
    expect(deleteRow.meta).toMatchObject({ name: 'ActLog Teal' });
  });

  it('does not log a color update that changes nothing', async () => {
    const color = await prisma.color.create({
      data: { name: 'ActLog Same', hex: '#111111' },
    });
    await call('@/pages/api/colors/index.page', {
      method: 'PUT',
      url: '/api/colors',
      body: { colorPairs: [{ id: color.id, name: 'ActLog Same' }] },
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 400);
    });
    const rows = await prisma.adminActivity.findMany({
      where: { targetId: color.id },
    });
    expect(rows).toHaveLength(0);
  });

  it('records brand create, rename and delete', async () => {
    const created = await call('@/pages/api/brand/index.page', {
      method: 'POST',
      url: '/api/brand',
      body: { name: 'ActLog Brand' },
    });
    expect(created.status).toBe(201);
    const brandId = created.body.data.id as string;
    await activityFor('BRAND', 'CREATE', brandId);

    await call('@/pages/api/brand/index.page', {
      method: 'PUT',
      url: '/api/brand',
      body: { id: brandId, name: 'ActLog Brand 2' },
    });
    const renameRow = await activityFor('BRAND', 'UPDATE', brandId);
    expect(renameRow.meta).toEqual({
      name: 'ActLog Brand 2',
      changes: { name: { from: 'ActLog Brand', to: 'ActLog Brand 2' } },
    });

    await call('@/pages/api/brand/index.page', {
      method: 'DELETE',
      url: '/api/brand',
      query: { id: brandId },
    });
    await activityFor('BRAND', 'DELETE', brandId);
  });

  it('keeps the row and the name after the actor is deleted', async () => {
    const other = await createStaffPrincipal(prisma, 'ADMIN');
    const otherUser = await prisma.user.findUniqueOrThrow({
      where: { id: other.userId },
    });
    const row = await prisma.adminActivity.create({
      data: {
        userId: other.userId,
        userName: otherUser.name,
        entity: 'BRAND',
        action: 'CREATE',
        targetId: 'x',
      },
    });

    await prisma.user.delete({ where: { id: other.userId } });

    const kept = await prisma.adminActivity.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(kept.userId).toBeNull();
    expect(kept.userName).toBe(otherUser.name);
    await prisma.adminActivity.delete({ where: { id: row.id } });
  });
});
