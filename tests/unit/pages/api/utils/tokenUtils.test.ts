import { UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
} from '@/pages/lib/constants';

describe('tokenUtils.generateTokens', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('issues access and refresh tokens with env secrets and expiries', async () => {
    vi.stubEnv('ACCESS_TOKEN_SECRET', 'unit-access-secret');
    vi.stubEnv('REFRESH_TOKEN_SECRET', 'unit-refresh-secret');

    let signCall = 0;
    const signSpy = vi.spyOn(jwt, 'sign').mockImplementation(() => {
      signCall += 1;
      return signCall === 1 ? 'signed-access' : 'signed-refresh';
    });

    const { generateTokens } = await import('@/pages/api/utils/tokenUtils');

    const tokens = generateTokens('user-99', UserRole.ADMIN);

    expect(tokens).toEqual({
      accessToken: 'signed-access',
      refreshToken: 'signed-refresh',
    });

    expect(signSpy).toHaveBeenNthCalledWith(
      1,
      { userId: 'user-99', grade: UserRole.ADMIN },
      'unit-access-secret',
      { expiresIn: ACCESS_TOKEN_EXPIRY },
    );
    expect(signSpy).toHaveBeenNthCalledWith(
      2,
      { userId: 'user-99', grade: UserRole.ADMIN },
      'unit-refresh-secret',
      { expiresIn: REFRESH_TOKEN_EXPIRY },
    );
  });
});
