import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';

export type TestSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
};

function parseRefreshCookie(res: {
  getHeader: (name: string) => string | string[] | number | undefined;
}): string {
  const h = res.getHeader('Set-Cookie');
  const str = Array.isArray(h) ? h.join(';') : String(h ?? '');
  const m = str.match(/REFRESH_TOKEN=([^;]+)/);
  if (!m?.[1]) {
    throw new Error('Expected REFRESH_TOKEN in Set-Cookie after signup');
  }
  return m[1].trim();
}

export async function signupTestUser(prefix = 'user'): Promise<TestSession> {
  const signup = (await import('@/pages/api/user/signup.page')).default;
  const email = `${prefix}-${Date.now()}@test.local`;
  const { req, res } = createMocks({
    method: 'POST',
    url: '/api/user/signup',
    body: {
      email,
      name: 'Test User',
      password: 'Secret1!x',
      phoneNumber: '+1000',
    },
  });

  await signup(
    req as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  );

  const json = JSON.parse(res._getData() as string);
  if (!json.success) {
    throw new Error(`signup failed: ${JSON.stringify(json)}`);
  }
  return {
    accessToken: json.data.accessToken,
    refreshToken: parseRefreshCookie(res),
    userId: json.data.user.id,
    email,
  };
}
