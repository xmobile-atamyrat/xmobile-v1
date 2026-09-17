import type { NextApiRequest, NextApiResponse } from 'next';
import { afterEach, describe, expect, it, vi } from 'vitest';

import addCors from '@/pages/api/utils/addCors';

const NATIVE_APP_ORIGIN = 'http://216.250.13.115:3001';
const STAGING_ORIGIN = 'http://dev.xmobile.com.tm';

function makeReqRes({
  method = 'GET',
  origin,
  vary,
}: { method?: string; origin?: string; vary?: string } = {}) {
  const headers: Record<string, string> = {};
  if (origin) headers.origin = origin;

  const sent: Record<string, string | string[]> = {};
  if (vary) sent.Vary = vary;

  const setHeader = vi.fn((name: string, value: string | string[]) => {
    sent[name] = value;
  });
  const end = vi.fn();
  const status = vi.fn(() => ({ end }));

  const req = { method, headers } as unknown as NextApiRequest;
  const res = {
    setHeader,
    status,
    end,
    getHeader: (name: string) => sent[name],
  } as unknown as NextApiResponse;

  return { req, res, setHeader, status, end, sent };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('addCors', () => {
  it('reports that a normal request was not handled', () => {
    const { req, res, status } = makeReqRes();

    expect(addCors(req, res)).toBe(false);
    expect(status).not.toHaveBeenCalled();
  });

  it('keeps open, credential-less access for unknown origins', () => {
    const { req, res, sent } = makeReqRes({ origin: 'https://example.com' });

    addCors(req, res);

    expect(sent['Access-Control-Allow-Origin']).toBe('*');
    expect(sent['Access-Control-Allow-Credentials']).toBeUndefined();
  });

  it('advertises the headers the client actually sends', () => {
    const { req, res, sent } = makeReqRes();

    addCors(req, res);

    // useFetchWithCreds() sends this one; omitting it failed the preflight.
    expect(sent['Access-Control-Allow-Headers']).toContain('Authorization');
    // ...and reads a rotated token back off the response.
    expect(sent['Access-Control-Expose-Headers']).toContain('Authorization');
    expect(sent['X-Robots-Tag']).toBe('noindex');
  });
});

describe('addCors preflight', () => {
  // The bug: a preflight fell through to the route's method routing and came
  // back 405. A preflight must be 2xx or the real request is never sent.
  it('answers a preflight with 204 instead of falling through to 405', () => {
    const { req, res, status, end } = makeReqRes({
      method: 'OPTIONS',
      origin: NATIVE_APP_ORIGIN,
    });

    expect(addCors(req, res)).toBe(true);
    expect(status).toHaveBeenCalledWith(204);
    expect(end).toHaveBeenCalled();
  });

  it('caches the preflight so it is not repeated before every call', () => {
    const { req, res, sent } = makeReqRes({ method: 'OPTIONS' });

    addCors(req, res);

    expect(sent['Access-Control-Max-Age']).toBeTruthy();
  });
});

describe('addCors credentialed origins', () => {
  it.each([
    ['the native app origin', NATIVE_APP_ORIGIN],
    ['the staging web origin', STAGING_ORIGIN],
    ['production', 'https://xmobile.com.tm'],
  ])('echoes %s and allows credentials', (_label, origin) => {
    const { req, res, sent } = makeReqRes({ origin });

    addCors(req, res);

    // A wildcard cannot be combined with credentials -- the browser rejects it.
    expect(sent['Access-Control-Allow-Origin']).toBe(origin);
    expect(sent['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('varies on Origin so one origin is not cached for another', () => {
    const { req, res, sent } = makeReqRes({ origin: STAGING_ORIGIN });

    addCors(req, res);

    expect(String(sent.Vary)).toContain('Origin');
  });

  it('keeps a Vary value Next already set', () => {
    const { req, res, sent } = makeReqRes({
      origin: STAGING_ORIGIN,
      vary: 'Accept-Encoding',
    });

    addCors(req, res);

    expect(String(sent.Vary)).toContain('Accept-Encoding');
    expect(String(sent.Vary)).toContain('Origin');
  });

  it('trusts a local dev origin outside production', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'development');
    const { req, res, sent } = makeReqRes({ origin: 'http://localhost:8081' });

    addCors(req, res);

    expect(sent['Access-Control-Allow-Credentials']).toBe('true');
  });

  // Otherwise a page served from the victim's own machine could read their
  // session.
  it('does not trust a local origin in production', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production');
    const { req, res, sent } = makeReqRes({ origin: 'http://localhost:8081' });

    addCors(req, res);

    expect(sent['Access-Control-Allow-Origin']).toBe('*');
    expect(sent['Access-Control-Allow-Credentials']).toBeUndefined();
  });

  it('never reflects an arbitrary site', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production');
    const { req, res, sent } = makeReqRes({
      origin: 'https://xmobile.com.tm.evil.example',
    });

    addCors(req, res);

    expect(sent['Access-Control-Allow-Origin']).toBe('*');
    expect(sent['Access-Control-Allow-Credentials']).toBeUndefined();
  });
});
