import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireSuperuserBearerAuth = vi.fn();
const requireUserBearerAuth = vi.fn();
const approveAuthorization = vi.fn();
const buildRedirect = vi.fn();

vi.mock('@/lib/mcp/oauthHttp', () => ({
  beginOAuthRoute: () => 'https://xmobile.test',
  field: (body: Record<string, unknown>, name: string) => body[name],
  sendOAuthError: vi.fn(),
}));
vi.mock('@/lib/mcp/oauthStore', () => ({
  OAuthError: class extends Error {},
  approveAuthorization: (...args: unknown[]) => approveAuthorization(...args),
  buildRedirect: (...args: unknown[]) => buildRedirect(...args),
  validateAuthorizeRequest: vi.fn().mockResolvedValue({
    clientId: 'xmcp_client_abc',
    redirectUri: 'https://chatgpt.com/cb',
    state: null,
  }),
}));
vi.mock('@/pages/api/utils/staffAuth', () => ({
  requireSuperuserBearerAuth: (...args: unknown[]) =>
    requireSuperuserBearerAuth(...args),
  requireUserBearerAuth: (...args: unknown[]) => requireUserBearerAuth(...args),
}));

/** Answers 401 the way the real helpers do, for a request without a token. */
function rejectUnauthenticated(_req: unknown, res: NextApiResponse): null {
  res.status(401).json({ success: false, message: 'Unauthorized' });
  return null;
}

describe('/api/mcp/oauth/approve', () => {
  beforeEach(() => {
    requireSuperuserBearerAuth.mockReset();
    requireUserBearerAuth.mockReset();
    approveAuthorization.mockReset();
    buildRedirect.mockReset();
  });

  async function decide(decision: 'approve' | 'deny') {
    const handler = (await import('@/pages/api/mcp/oauth/approve.page'))
      .default;
    const { req, res } = createMocks({
      method: 'POST',
      body: { decision },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    return res;
  }

  it('answers 401 when the token passed but names no user', async () => {
    requireSuperuserBearerAuth.mockResolvedValue({
      userId: undefined,
      grade: 'SUPERUSER',
    });
    const res = await decide('approve');
    expect(res._getStatusCode()).toBe(401);
    expect(res._isEndCalled()).toBe(true);
    expect(approveAuthorization).not.toHaveBeenCalled();
  });

  it('approves for the superuser the token names', async () => {
    requireSuperuserBearerAuth.mockResolvedValue({
      userId: 'user-1',
      grade: 'SUPERUSER',
    });
    approveAuthorization.mockReturnValue('https://chatgpt.com/cb?code=x');
    const res = await decide('approve');
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({
      redirectTo: 'https://chatgpt.com/cb?code=x',
    });
    expect(approveAuthorization.mock.calls[0][1]).toEqual({
      userId: 'user-1',
      grade: 'SUPERUSER',
    });
  });

  it('refuses to deny for someone who is not signed in', async () => {
    requireUserBearerAuth.mockImplementation(rejectUnauthenticated);
    const res = await decide('deny');
    expect(res._getStatusCode()).toBe(401);
    expect(buildRedirect).not.toHaveBeenCalled();
  });

  it('denies for any signed-in user', async () => {
    requireUserBearerAuth.mockResolvedValue({
      userId: 'user-2',
      grade: 'FREE',
    });
    buildRedirect.mockReturnValue('https://chatgpt.com/cb?error=access_denied');
    const res = await decide('deny');
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({
      redirectTo: 'https://chatgpt.com/cb?error=access_denied',
    });
    expect(buildRedirect.mock.calls[0][2]).toEqual({ error: 'access_denied' });
    expect(requireSuperuserBearerAuth).not.toHaveBeenCalled();
    expect(approveAuthorization).not.toHaveBeenCalled();
  });
});
