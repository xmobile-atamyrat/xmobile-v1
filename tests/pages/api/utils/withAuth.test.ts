import { UserRole } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_REFRESH_COOKIE_NAME } from '@/pages/lib/constants';

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));

vi.mock('@/pages/api/utils/tokenUtils', () => ({
  ACCESS_SECRET: 'unit-access-secret',
  generateTokens: vi.fn(() => ({
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
  })),
}));

import jwt from 'jsonwebtoken';
import withAuth, {
  type AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { generateTokens } from '@/pages/api/utils/tokenUtils';

function createMockRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    end: vi.fn(),
    setHeader: vi.fn(),
  };
  res.status.mockImplementation(() => res);
  return res as unknown as NextApiResponse;
}

describe('withAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('REFRESH_TOKEN_SECRET', 'unit-refresh-secret');
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('calls the handler without verifying JWT for bypassed GET routes', async () => {
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error('verify should not run');
    });

    const handler = vi.fn(
      async (_req: AuthenticatedRequest, res: NextApiResponse) => {
        res.status(200).json({ ok: true });
      },
    );

    const wrapped = withAuth(handler);
    const req = {
      url: '/api/prices',
      method: 'GET',
      headers: {},
      cookies: {},
    } as unknown as NextApiRequest;
    const res = createMockRes();

    await wrapped(req, res);

    expect(handler).toHaveBeenCalled();
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  it('returns 401 when neither Bearer header nor refresh cookie is present', async () => {
    const wrapped = withAuth(
      vi.fn(async () => {
        /* noop */
      }),
    );
    const req = {
      url: '/api/cart',
      method: 'POST',
      headers: {},
      cookies: {},
    } as unknown as NextApiRequest;
    const res = createMockRes();

    await wrapped(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unauthorized: Missing or invalid token format',
    });
  });

  it('attaches userId and grade when access token verifies', async () => {
    vi.mocked(jwt.verify).mockImplementation((_t, _s, callback: any) => {
      callback(null, { userId: 'user-1', grade: UserRole.ADMIN });
    });

    const handler = vi.fn(
      async (req: AuthenticatedRequest, res: NextApiResponse) => {
        expect(req.userId).toBe('user-1');
        expect(req.grade).toBe(UserRole.ADMIN);
        res.status(200).end();
      },
    );

    const wrapped = withAuth(handler);
    const req = {
      url: '/api/cart',
      method: 'POST',
      headers: { authorization: 'Bearer access-token' },
      cookies: {},
    } as unknown as NextApiRequest;
    const res = createMockRes();

    await wrapped(req, res);

    expect(handler).toHaveBeenCalled();
  });

  it('refreshes tokens when access token is expired and refresh is valid', async () => {
    vi.mocked(jwt.verify).mockImplementation(
      (_token, secret, callback: any) => {
        if (secret === 'unit-access-secret') {
          const err = new Error('jwt expired');
          err.name = 'TokenExpiredError';
          callback(err);
        } else {
          callback(null, { userId: 'user-2', grade: UserRole.FREE });
        }
      },
    );

    const handler = vi.fn(
      async (_req: AuthenticatedRequest, res: NextApiResponse) => {
        res.status(200).end();
      },
    );

    const wrapped = withAuth(handler);
    const req = {
      url: '/api/cart',
      method: 'POST',
      headers: { authorization: 'Bearer expired-access' },
      cookies: { [AUTH_REFRESH_COOKIE_NAME]: 'refresh-token-value' },
    } as unknown as NextApiRequest;
    const res = createMockRes();

    await wrapped(req, res);

    expect(generateTokens).toHaveBeenCalledWith('user-2', UserRole.FREE);
    expect(res.setHeader).toHaveBeenCalled();
    expect(handler).toHaveBeenCalled();
  });

  it('returns 401 when access token is invalid (non-expired error)', async () => {
    vi.mocked(jwt.verify).mockImplementation((_t, _s, callback: any) => {
      callback(new Error('invalid signature'));
    });

    const wrapped = withAuth(
      vi.fn(async () => {
        /* noop */
      }),
    );
    const req = {
      url: '/api/cart',
      method: 'POST',
      headers: { authorization: 'Bearer bad' },
      cookies: {},
    } as unknown as NextApiRequest;
    const res = createMockRes();

    await wrapped(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unauthorized: Invalid token',
    });
  });
});
