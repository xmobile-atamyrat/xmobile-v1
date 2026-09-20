import { NextApiRequest } from 'next';
import { describe, expect, it } from 'vitest';

import {
  isSecureRequest,
  secureCookieAttr,
} from '@/pages/api/utils/requestScheme';

function makeReq({
  headers = {},
  encrypted = false,
}: {
  headers?: Record<string, string | string[]>;
  encrypted?: boolean;
}): NextApiRequest {
  return {
    headers,
    socket: { encrypted },
  } as unknown as NextApiRequest;
}

describe('isSecureRequest', () => {
  it('is false for a plain HTTP request (staging over http://)', () => {
    expect(isSecureRequest(makeReq({}))).toBe(false);
  });

  it('is true when terminated TLS is reported by the proxy', () => {
    expect(
      isSecureRequest(makeReq({ headers: { 'x-forwarded-proto': 'https' } })),
    ).toBe(true);
  });

  it('is false when the proxy reports plain http', () => {
    expect(
      isSecureRequest(makeReq({ headers: { 'x-forwarded-proto': 'http' } })),
    ).toBe(false);
  });

  it('uses the first hop of a proxy chain', () => {
    expect(
      isSecureRequest(
        makeReq({ headers: { 'x-forwarded-proto': 'https,http' } }),
      ),
    ).toBe(true);
  });

  it('tolerates a header repeated as an array', () => {
    expect(
      isSecureRequest(makeReq({ headers: { 'x-forwarded-proto': ['https'] } })),
    ).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(
      isSecureRequest(makeReq({ headers: { 'x-forwarded-proto': 'HTTPS' } })),
    ).toBe(true);
  });

  it('falls back to a directly-terminated TLS socket', () => {
    expect(isSecureRequest(makeReq({ encrypted: true }))).toBe(true);
  });
});

describe('secureCookieAttr', () => {
  it('omits Secure over http so the browser will store the cookie', () => {
    expect(secureCookieAttr(makeReq({}))).toBe('');
  });

  it('emits a Secure attribute over https', () => {
    expect(
      secureCookieAttr(makeReq({ headers: { 'x-forwarded-proto': 'https' } })),
    ).toBe('Secure; ');
  });
});
