import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('FCM token API (integration)', () => {
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

  it('POST registers token (201) and GET returns masked list', async () => {
    const session = await signupTestUser('fcm-a');
    const handler = (await import('@/pages/api/fcm/token.page')).default;
    const token = `tok-${Date.now()}-aaaaaaaaaaaaaaaaaaaaaaaa`;
    const device = `device-${Date.now()}-a`;

    const post = createMocks({
      method: 'POST',
      url: '/api/fcm/token',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: { token, deviceInfo: device },
    });
    await handler(
      post.req as unknown as NextApiRequest,
      post.res as unknown as NextApiResponse,
    );
    expect(post.res._getStatusCode()).toBe(201);

    const get = createMocks({
      method: 'GET',
      url: '/api/fcm/token',
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    await handler(
      get.req as unknown as NextApiRequest,
      get.res as unknown as NextApiResponse,
    );
    expect(get.res._getStatusCode()).toBe(200);
    const list = JSON.parse(get.res._getData() as string).data as unknown[];
    expect(list.length).toBeGreaterThanOrEqual(1);

    const del = createMocks({
      method: 'DELETE',
      url: '/api/fcm/token',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: { token },
    });
    await handler(
      del.req as unknown as NextApiRequest,
      del.res as unknown as NextApiResponse,
    );
    expect(del.res._getStatusCode()).toBe(200);
  });

  it('POST updates token for same deviceInfo (same user)', async () => {
    const session = await signupTestUser('fcm-upd');
    const handler = (await import('@/pages/api/fcm/token.page')).default;
    const device = `device-upd-${Date.now()}`;

    const first = createMocks({
      method: 'POST',
      url: '/api/fcm/token',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: { token: `t1-${Date.now()}`, deviceInfo: device },
    });
    await handler(
      first.req as unknown as NextApiRequest,
      first.res as unknown as NextApiResponse,
    );
    expect(first.res._getStatusCode()).toBe(201);

    const second = createMocks({
      method: 'POST',
      url: '/api/fcm/token',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: { token: `t2-${Date.now()}`, deviceInfo: device },
    });
    await handler(
      second.req as unknown as NextApiRequest,
      second.res as unknown as NextApiResponse,
    );
    expect(second.res._getStatusCode()).toBe(200);

    await prisma.fCMToken.deleteMany({ where: { deviceInfo: device } });
  });

  it('POST returns 400 when token is already owned by another user', async () => {
    const a = await signupTestUser('fcm-own-a');
    const b = await signupTestUser('fcm-own-b');
    const handler = (await import('@/pages/api/fcm/token.page')).default;
    const sharedToken = `shared-tok-${Date.now()}`;

    const regA = createMocks({
      method: 'POST',
      url: '/api/fcm/token',
      headers: { authorization: `Bearer ${a.accessToken}` },
      body: { token: sharedToken, deviceInfo: `dev-a-${Date.now()}` },
    });
    await handler(
      regA.req as unknown as NextApiRequest,
      regA.res as unknown as NextApiResponse,
    );
    expect(regA.res._getStatusCode()).toBe(201);

    const regB = createMocks({
      method: 'POST',
      url: '/api/fcm/token',
      headers: { authorization: `Bearer ${b.accessToken}` },
      body: { token: sharedToken, deviceInfo: `dev-b-${Date.now()}` },
    });
    await handler(
      regB.req as unknown as NextApiRequest,
      regB.res as unknown as NextApiResponse,
    );
    expect(regB.res._getStatusCode()).toBe(400);

    await prisma.fCMToken.deleteMany({ where: { token: sharedToken } });
  });

  it('reassigns deviceInfo from another user to current user', async () => {
    const a = await signupTestUser('fcm-re-a');
    const b = await signupTestUser('fcm-re-b');
    const handler = (await import('@/pages/api/fcm/token.page')).default;
    const device = `shared-dev-${Date.now()}`;

    const regA = createMocks({
      method: 'POST',
      url: '/api/fcm/token',
      headers: { authorization: `Bearer ${a.accessToken}` },
      body: { token: `tok-a-${Date.now()}`, deviceInfo: device },
    });
    await handler(
      regA.req as unknown as NextApiRequest,
      regA.res as unknown as NextApiResponse,
    );

    const reassign = createMocks({
      method: 'POST',
      url: '/api/fcm/token',
      headers: { authorization: `Bearer ${b.accessToken}` },
      body: { token: `tok-b-${Date.now()}`, deviceInfo: device },
    });
    await handler(
      reassign.req as unknown as NextApiRequest,
      reassign.res as unknown as NextApiResponse,
    );
    expect(reassign.res._getStatusCode()).toBe(200);

    const row = await prisma.fCMToken.findUnique({
      where: { deviceInfo: device },
    });
    expect(row?.userId).toBe(b.userId);

    await prisma.fCMToken.deleteMany({ where: { deviceInfo: device } });
  });

  it('DELETE returns 403 when token belongs to another user', async () => {
    const a = await signupTestUser('fcm-del-a');
    const b = await signupTestUser('fcm-del-b');
    const handler = (await import('@/pages/api/fcm/token.page')).default;
    const token = `del-tok-${Date.now()}`;

    const reg = createMocks({
      method: 'POST',
      url: '/api/fcm/token',
      headers: { authorization: `Bearer ${a.accessToken}` },
      body: { token, deviceInfo: `del-dev-${Date.now()}` },
    });
    await handler(
      reg.req as unknown as NextApiRequest,
      reg.res as unknown as NextApiResponse,
    );

    const del = createMocks({
      method: 'DELETE',
      url: '/api/fcm/token',
      headers: { authorization: `Bearer ${b.accessToken}` },
      body: { token },
    });
    await handler(
      del.req as unknown as NextApiRequest,
      del.res as unknown as NextApiResponse,
    );
    expect(del.res._getStatusCode()).toBe(403);

    await prisma.fCMToken.deleteMany({ where: { token } });
  });

  it('POST returns 400 on validation error', async () => {
    const session = await signupTestUser('fcm-zod');
    const handler = (await import('@/pages/api/fcm/token.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/fcm/token',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: { token: '', deviceInfo: '' },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(400);
  });

  it('DELETE returns 404 for unknown token', async () => {
    const session = await signupTestUser('fcm-404');
    const handler = (await import('@/pages/api/fcm/token.page')).default;
    const { req, res } = createMocks({
      method: 'DELETE',
      url: '/api/fcm/token',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: { token: 'missing-token-xxxxxxxx' },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(404);
  });
});
