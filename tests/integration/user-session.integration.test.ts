import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('User session refresh (GET /api/user) (integration)', () => {
  beforeAll(async () => {
    await prepareIntegrationWorker();
  }, 180_000);

  afterAll(async () => {
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('returns 401 when refresh cookie is missing', async () => {
    const handler = (await import('@/pages/api/user/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/user',
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(401);
  });

  it('returns 200 with new access token when refresh cookie is valid', async () => {
    const session = await signupTestUser('refresh');
    const handler = (await import('@/pages/api/user/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/user',
      cookies: { REFRESH_TOKEN: session.refreshToken },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.success).toBe(true);
    expect(json.data.accessToken).toBeTruthy();
    expect(json.data.user.id).toBe(session.userId);
    expect((res.getHeader('Set-Cookie') as string) ?? '').toContain(
      'REFRESH_TOKEN=',
    );
  });

  it('returns 405 for non-GET', async () => {
    const session = await signupTestUser('refresh-method');
    const handler = (await import('@/pages/api/user/index.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/user',
      cookies: { REFRESH_TOKEN: session.refreshToken },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(405);
  });
});
