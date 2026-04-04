import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Auth API (integration)', () => {
  beforeAll(async () => {
    await prepareIntegrationWorker();
  }, 180_000);

  afterAll(async () => {
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('POST /api/user/signup returns tokens and sets refresh cookie', async () => {
    const signup = (await import('@/pages/api/user/signup.page')).default;
    const email = `new-${Date.now()}@test.local`;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/user/signup',
      body: {
        email,
        name: 'New User',
        password: 'Secret1!',
        phoneNumber: '+100',
      },
    });

    await signup(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );

    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.success).toBe(true);
    expect(json.data.accessToken).toBeTruthy();
    expect(json.data.user.email).toBe(email);
    expect((res.getHeader('Set-Cookie') as string) ?? '').toContain(
      'REFRESH_TOKEN=',
    );
  });

  it('POST /api/user/signup rejects duplicate email', async () => {
    const signup = (await import('@/pages/api/user/signup.page')).default;
    const email = `dup-${Date.now()}@test.local`;
    const body = {
      email,
      name: 'A',
      password: 'Secret1!',
      phoneNumber: '+1',
    };

    const first = createMocks({
      method: 'POST',
      url: '/api/user/signup',
      body,
    });
    await signup(
      first.req as unknown as NextApiRequest,
      first.res as unknown as NextApiResponse,
    );
    expect(first.res._getStatusCode()).toBe(200);

    const second = createMocks({
      method: 'POST',
      url: '/api/user/signup',
      body,
    });
    await signup(
      second.req as unknown as NextApiRequest,
      second.res as unknown as NextApiResponse,
    );
    expect(second.res._getStatusCode()).toBe(400);
    expect(JSON.parse(second.res._getData() as string).message).toBe(
      'userAlreadyExists',
    );
  });

  it('POST /api/user/signin succeeds after signup', async () => {
    const signup = (await import('@/pages/api/user/signup.page')).default;
    const signin = (await import('@/pages/api/user/signin.page')).default;
    const email = `login-${Date.now()}@test.local`;
    const password = 'Correct1!';

    const signupMocks = createMocks({
      method: 'POST',
      url: '/api/user/signup',
      body: {
        email,
        name: 'Login User',
        password,
        phoneNumber: '+2',
      },
    });
    await signup(
      signupMocks.req as unknown as NextApiRequest,
      signupMocks.res as unknown as NextApiResponse,
    );

    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/user/signin',
      body: { email, password },
    });
    await signin(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.success).toBe(true);
    expect(json.data.accessToken).toBeTruthy();
  });

  it('POST /api/user/signin rejects unknown email', async () => {
    const signin = (await import('@/pages/api/user/signin.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/user/signin',
      body: { email: 'missing@test.local', password: 'x' },
    });
    await signin(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData() as string).message).toBe('userNotFound');
  });

  it('POST /api/user/signin rejects wrong password', async () => {
    const signup = (await import('@/pages/api/user/signup.page')).default;
    const signin = (await import('@/pages/api/user/signin.page')).default;
    const email = `pw-${Date.now()}@test.local`;
    const s = createMocks({
      method: 'POST',
      url: '/api/user/signup',
      body: {
        email,
        name: 'Pw User',
        password: 'Right1!',
        phoneNumber: '+3',
      },
    });
    await signup(
      s.req as unknown as NextApiRequest,
      s.res as unknown as NextApiResponse,
    );

    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/user/signin',
      body: { email, password: 'Wrong1!' },
    });
    await signin(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData() as string).message).toBe(
      'passwordIncorrect',
    );
  });

  it('returns 405 for non-POST on signup and signin', async () => {
    const signup = (await import('@/pages/api/user/signup.page')).default;
    const signin = (await import('@/pages/api/user/signin.page')).default;

    const { req: rq, res: rs } = createMocks({
      method: 'GET',
      url: '/api/user/signup',
    });
    await signup(
      rq as unknown as NextApiRequest,
      rs as unknown as NextApiResponse,
    );
    expect(rs._getStatusCode()).toBe(405);

    const { req: rq2, res: rs2 } = createMocks({
      method: 'GET',
      url: '/api/user/signin',
    });
    await signin(
      rq2 as unknown as NextApiRequest,
      rs2 as unknown as NextApiResponse,
    );
    expect(rs2._getStatusCode()).toBe(405);
  });
});
