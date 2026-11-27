import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AnalyticsRequest,
  clientIp,
  isUuid,
  readCookie,
  readIdentity,
  resolveLocale,
  userIdFromRefreshCookie,
} from '@/lib/analytics/server/request';

vi.mock('@/lib/dbClient', () => ({ default: {} }));

const VID = '6f1c2b0e-8d4a-4c1e-9b7a-2f3d4e5a6b7c';
const SID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

function req(
  headers: AnalyticsRequest['headers'],
  cookies?: Record<string, string>,
): AnalyticsRequest {
  return { headers, cookies };
}

describe('isUuid', () => {
  it('accepts canonical UUIDs in either case', () => {
    expect(isUuid(VID)).toBe(true);
    expect(isUuid(VID.toUpperCase())).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['too short', '6f1c2b0e-8d4a-4c1e-9b7a-2f3d4e5a6b7'],
    ['no dashes', '6f1c2b0e8d4a4c1e9b7a2f3d4e5a6b7c'],
    ['not hex', 'zzzzzzzz-8d4a-4c1e-9b7a-2f3d4e5a6b7c'],
    ['SQL-ish', "x' OR 1=1 --"],
    ['a number', 42],
    ['undefined', undefined],
  ])('rejects %s', (_label, value) => {
    expect(isUuid(value)).toBe(false);
  });
});

describe('readCookie', () => {
  it('reads parsed cookies when the request has them', () => {
    expect(readCookie(req({}, { a: '1' }), 'a')).toBe('1');
    expect(readCookie(req({}, {}), 'a')).toBeUndefined();
  });

  it('parses the Cookie header when there is no cookies object', () => {
    const r = req({ cookie: 'x=1; xa_vid=abc%20d; other=2; xa_vid=second' });
    expect(readCookie(r, 'xa_vid')).toBe('abc d');
    expect(readCookie(r, 'other')).toBe('2');
    expect(readCookie(r, 'missing')).toBeUndefined();
  });

  it('does not match a cookie whose name merely ends with the name', () => {
    expect(
      readCookie(req({ cookie: 'not_xa_vid=1' }), 'xa_vid'),
    ).toBeUndefined();
  });
});

describe('readIdentity', () => {
  it('returns both ids when they are valid UUIDs, lowercased', () => {
    expect(
      readIdentity(req({}, { xa_vid: VID.toUpperCase(), xa_sid: SID })),
    ).toEqual({ visitorId: VID, sessionId: SID });
  });

  it('nulls out a missing or malformed id independently', () => {
    expect(readIdentity(req({}, { xa_vid: VID, xa_sid: 'nope' }))).toEqual({
      visitorId: VID,
      sessionId: null,
    });
    expect(readIdentity(req({}, { xa_sid: SID }))).toEqual({
      visitorId: null,
      sessionId: SID,
    });
    expect(readIdentity(req({}, { xa_vid: 'abc' }))).toEqual({
      visitorId: null,
      sessionId: null,
    });
  });

  it('works from a raw Cookie header (ws-server style request)', () => {
    expect(
      readIdentity(req({ cookie: `xa_vid=${VID}; xa_sid=${SID}` })),
    ).toEqual({
      visitorId: VID,
      sessionId: SID,
    });
  });
});

describe('resolveLocale', () => {
  it('prefers a valid explicit value', () => {
    expect(
      resolveLocale(
        req({ referer: 'https://x.tm/tr/product/a' }, { NEXT_LOCALE: 'en' }),
        'tk',
      ),
    ).toBe('tk');
  });

  it('falls back to the NEXT_LOCALE cookie when the explicit value is not a locale', () => {
    expect(resolveLocale(req({}, { NEXT_LOCALE: 'en' }), 'de')).toBe('en');
    expect(resolveLocale(req({}, { NEXT_LOCALE: 'ch' }), undefined)).toBe('ch');
    expect(resolveLocale(req({}, { NEXT_LOCALE: 'en' }), 42)).toBe('en');
  });

  it('then the first path segment of the Referer', () => {
    expect(
      resolveLocale(req({ referer: 'https://x.tm/tr/product/a?b=1' }, {})),
    ).toBe('tr');
    expect(
      resolveLocale(req({ referer: 'https://x.tm/en' }, { NEXT_LOCALE: 'xx' })),
    ).toBe('en');
  });

  it('ignores a Referer whose first segment is not a locale', () => {
    expect(resolveLocale(req({ referer: 'https://x.tm/product/en' }, {}))).toBe(
      'ru',
    );
    expect(resolveLocale(req({ referer: 'not a url' }, {}))).toBe('ru');
  });

  it('defaults to ru', () => {
    expect(resolveLocale(req({}, {}))).toBe('ru');
  });
});

describe('clientIp', () => {
  it('prefers X-Real-IP, then the first X-Forwarded-For hop, then the socket', () => {
    expect(
      clientIp({
        headers: { 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' },
        socket: { remoteAddress: '3.3.3.3' },
      }),
    ).toBe('1.1.1.1');
    expect(
      clientIp({
        headers: { 'x-forwarded-for': '2.2.2.2, 10.0.0.1' },
        socket: { remoteAddress: '3.3.3.3' },
      }),
    ).toBe('2.2.2.2');
    expect(
      clientIp({ headers: {}, socket: { remoteAddress: '3.3.3.3' } }),
    ).toBe('3.3.3.3');
    expect(clientIp({ headers: {} })).toBe('');
  });
});

describe('userIdFromRefreshCookie', () => {
  const SECRET = 'unit-refresh-secret';

  beforeEach(() => {
    vi.stubEnv('REFRESH_TOKEN_SECRET', SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the userId of a valid refresh token', async () => {
    const token = jwt.sign({ userId: 'user-1', grade: 'FREE' }, SECRET);
    await expect(
      userIdFromRefreshCookie(req({}, { REFRESH_TOKEN: token })),
    ).resolves.toBe('user-1');
  });

  it('returns null for a missing, forged or expired token', async () => {
    await expect(userIdFromRefreshCookie(req({}, {}))).resolves.toBeNull();
    const forged = jwt.sign({ userId: 'user-1' }, 'other-secret');
    await expect(
      userIdFromRefreshCookie(req({}, { REFRESH_TOKEN: forged })),
    ).resolves.toBeNull();
    const expired = jwt.sign({ userId: 'user-1' }, SECRET, { expiresIn: -10 });
    await expect(
      userIdFromRefreshCookie(req({}, { REFRESH_TOKEN: expired })),
    ).resolves.toBeNull();
    await expect(
      userIdFromRefreshCookie(req({}, { REFRESH_TOKEN: 'garbage' })),
    ).resolves.toBeNull();
  });

  it('returns null when no secret is configured', async () => {
    const token = jwt.sign({ userId: 'user-1' }, SECRET);
    vi.stubEnv('REFRESH_TOKEN_SECRET', '');
    await expect(
      userIdFromRefreshCookie(req({}, { REFRESH_TOKEN: token })),
    ).resolves.toBeNull();
  });
});
