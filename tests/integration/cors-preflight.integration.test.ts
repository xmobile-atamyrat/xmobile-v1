import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

/**
 * The native app loads its WebView from the bare-IP origin while the bundle it
 * runs calls BASE_URL, so every API call it makes is cross-origin. The browser
 * sends a preflight first, and a preflight that is not a 2xx blocks the real
 * request from ever being sent -- which is what silently killed add-to-cart.
 */
const APP_ORIGIN = 'http://216.250.13.115:3001';

async function preflight(
  importHandler: () => Promise<{
    default: (req: NextApiRequest, res: NextApiResponse) => unknown;
  }>,
  url: string,
) {
  const handler = (await importHandler()).default;
  const { req, res } = createMocks({
    method: 'OPTIONS',
    url,
    headers: {
      origin: APP_ORIGIN,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type,authorization',
    },
  });

  await handler(
    req as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  );

  return res;
}

describe('CORS preflight (integration)', () => {
  beforeAll(async () => {
    await prepareIntegrationWorker();
  }, 180_000);

  afterAll(async () => {
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('clears a preflight on the guest cart route', async () => {
    const res = await preflight(
      () => import('@/pages/api/guest/cart.page'),
      '/api/guest/cart',
    );

    expect(res._getStatusCode()).toBe(204);
    expect(res.getHeader('Access-Control-Allow-Origin')).toBe(APP_ORIGIN);
    // A wildcard here would make the browser reject the credentialed response.
    expect(res.getHeader('Access-Control-Allow-Credentials')).toBe('true');
    expect(String(res.getHeader('Access-Control-Allow-Headers'))).toContain(
      'Authorization',
    );
  });

  // A preflight carries no cookies and no Authorization header, so an
  // authenticated route must answer it before trying to authenticate it.
  it('clears a preflight on an authenticated route without a 401', async () => {
    const res = await preflight(
      () => import('@/pages/api/cart.page'),
      '/api/cart',
    );

    expect(res._getStatusCode()).not.toBe(401);
    expect(res._getStatusCode()).toBe(204);
  });

  it('still answers the real request after the preflight clears', async () => {
    const handler = (await import('@/pages/api/guest/cart.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/guest/cart',
      headers: { origin: APP_ORIGIN },
    });

    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader('Access-Control-Allow-Origin')).toBe(APP_ORIGIN);
    expect(res.getHeader('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('does not hand credentials to an unknown origin', async () => {
    const handler = (await import('@/pages/api/guest/cart.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/guest/cart',
      headers: { origin: 'https://evil.example' },
    });

    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );

    expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*');
    expect(res.getHeader('Access-Control-Allow-Credentials')).toBeUndefined();
  });
});
