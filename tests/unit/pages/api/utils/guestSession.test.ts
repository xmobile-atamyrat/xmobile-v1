import { NextApiRequest, NextApiResponse } from 'next';
import { describe, expect, it, vi } from 'vitest';

import { GUEST_SESSION_COOKIE_NAME } from '@/pages/lib/constants';

import { getOrCreateGuestSessionId } from '@/pages/api/utils/guestSession';

function makeReqRes({
  cookies = {},
  headers = {},
}: {
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}) {
  const req = { cookies, headers, socket: {} } as unknown as NextApiRequest;
  const setHeader = vi.fn();
  const res = { setHeader } as unknown as NextApiResponse;
  return { req, res, setHeader };
}

function setCookieValue(setHeader: ReturnType<typeof vi.fn>): string {
  const call = setHeader.mock.calls.find(([name]) => name === 'Set-Cookie');
  return (call?.[1] as string) ?? '';
}

describe('getOrCreateGuestSessionId', () => {
  it('reuses an existing session instead of minting a new one', () => {
    const { req, res, setHeader } = makeReqRes({
      cookies: { [GUEST_SESSION_COOKIE_NAME]: 'existing-id' },
    });

    expect(getOrCreateGuestSessionId(req, res)).toBe('existing-id');
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('mints and sets a session when none is present', () => {
    const { req, res, setHeader } = makeReqRes({});

    const id = getOrCreateGuestSessionId(req, res);

    expect(id).toBeTruthy();
    expect(setCookieValue(setHeader)).toContain(
      `${GUEST_SESSION_COOKIE_NAME}=${id}`,
    );
  });

  // The staging bug: a production build served over plain HTTP marked the
  // cookie Secure, so the browser discarded it. Every request then minted a
  // fresh session -- add-to-cart wrote under session A, the cart page read
  // session B and looked empty.
  it('omits Secure over plain HTTP so the browser stores the cookie', () => {
    const { req, res, setHeader } = makeReqRes({});

    getOrCreateGuestSessionId(req, res);

    expect(setCookieValue(setHeader)).not.toContain('Secure');
  });

  it('still marks the cookie Secure behind an HTTPS proxy', () => {
    const { req, res, setHeader } = makeReqRes({
      headers: { 'x-forwarded-proto': 'https' },
    });

    getOrCreateGuestSessionId(req, res);

    expect(setCookieValue(setHeader)).toContain('Secure');
  });

  it('keeps the session readable for the rest of the same request', () => {
    const { req, res } = makeReqRes({});

    const first = getOrCreateGuestSessionId(req, res);
    const second = getOrCreateGuestSessionId(req, res);

    expect(second).toBe(first);
  });

  it('scopes the cookie to the whole site and gives it a lifetime', () => {
    const { req, res, setHeader } = makeReqRes({});

    getOrCreateGuestSessionId(req, res);
    const cookie = setCookieValue(setHeader);

    expect(cookie).toContain('Path=/');
    expect(cookie).toMatch(/Max-Age=\d+/);
    expect(cookie).toContain('HttpOnly');
  });
});
