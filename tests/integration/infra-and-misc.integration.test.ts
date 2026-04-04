import type { NextApiRequest, NextApiResponse } from 'next';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CURRENCY, PrismaClient, UserRole } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Infra, FX, server logs, misc handlers (integration)', () => {
  let prisma: PrismaClient;
  const logsDir = path.join(process.cwd(), 'logs');

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();

    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(
      path.join(logsDir, 'integration-test.log'),
      'integration log line\n',
      'utf8',
    );
  }, 180_000);

  afterAll(async () => {
    try {
      fs.unlinkSync(path.join(logsDir, 'integration-test.log'));
    } catch {
      /* ignore */
    }
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('GET /api/localImage returns 404 when file missing', async () => {
    const handler = (await import('@/pages/api/localImage.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/localImage',
      query: { imgUrl: '/no/such/file.jpg' },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(404);
  });

  it('POST /api/prices/rate returns 401 for FREE user', async () => {
    const free = await signupTestUser('rate-free');
    const handler = (await import('@/pages/api/prices/rate.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/prices/rate',
      headers: { authorization: `Bearer ${free.accessToken}` },
      body: { rate: 1, currency: CURRENCY.USD },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(401);
  });

  it('SUPERUSER can POST a new dollar rate row (CNY)', async () => {
    await prisma.dollarRate.deleteMany({ where: { currency: CURRENCY.CNY } });
    const su = await createStaffPrincipal(prisma, UserRole.SUPERUSER);
    const handler = (await import('@/pages/api/prices/rate.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/prices/rate',
      headers: { authorization: `Bearer ${su.accessToken}` },
      body: { rate: 7.2, currency: CURRENCY.CNY },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);

    await prisma.dollarRate.deleteMany({ where: { currency: CURRENCY.CNY } });
    await prisma.user.delete({ where: { id: su.userId } });
  });

  it('ADMIN lists server log files and reads one entry', async () => {
    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    const index = (await import('@/pages/api/server-logs/index.page')).default;
    const list = createMocks({
      method: 'GET',
      url: '/api/server-logs',
      headers: { authorization: `Bearer ${admin.accessToken}` },
    });
    await index(
      list.req as unknown as NextApiRequest,
      list.res as unknown as NextApiResponse,
    );
    expect(list.res._getStatusCode()).toBe(200);
    const files = JSON.parse(list.res._getData() as string).data as string[];
    expect(files).toContain('integration-test.log');

    const fileHandler = (
      await import('@/pages/api/server-logs/[filename].page')
    ).default;
    const get = createMocks({
      method: 'GET',
      url: '/api/server-logs/x',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      query: { filename: 'integration-test.log' },
    });
    await fileHandler(
      get.req as unknown as NextApiRequest,
      get.res as unknown as NextApiResponse,
    );
    expect(get.res._getStatusCode()).toBe(200);
    const body = JSON.parse(get.res._getData() as string);
    expect(body.data.content).toContain('integration log line');

    const bad = createMocks({
      method: 'GET',
      url: '/api/server-logs/x',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      query: { filename: '../../../etc/passwd' },
    });
    await fileHandler(
      bad.req as unknown as NextApiRequest,
      bad.res as unknown as NextApiResponse,
    );
    expect(bad.res._getStatusCode()).toBe(400);

    await prisma.user.delete({ where: { id: admin.userId } });
  });

  it('notifications count rejects non-GET', async () => {
    const free = await signupTestUser('notif-405');
    const handler = (await import('@/pages/api/notifications/count.page'))
      .default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/notifications/count',
      headers: { authorization: `Bearer ${free.accessToken}` },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(405);
  });

  it('chat message handler rejects GET', async () => {
    const free = await signupTestUser('msg-405');
    const handler = (await import('@/pages/api/chat/message.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/chat/message',
      headers: { authorization: `Bearer ${free.accessToken}` },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(405);
  });
});
