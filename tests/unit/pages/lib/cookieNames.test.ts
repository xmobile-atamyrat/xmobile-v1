import { describe, expect, it } from 'vitest';

import {
  AUTH_REFRESH_COOKIE_NAME,
  GUEST_SESSION_COOKIE_NAME,
} from '@/pages/lib/constants';
import {
  authRefreshCookieName,
  authRefreshCookieNames,
  cookieNamespaceSuffix,
  guestSessionCookieName,
  readAuthRefreshCookie,
  readAuthRefreshCookieWith,
  readGuestSessionCookie,
} from '@/pages/lib/cookieNames';

const reqFor = (host?: string) => ({ headers: host ? { host } : {} });

const STAGING = 'dev.xmobile.com.tm';
const PRODUCTION = 'xmobile.com.tm';
const NATIVE_APP_ORIGIN = '216.250.13.115:3001';

describe('cookieNamespaceSuffix', () => {
  it('namespaces the staging host', () => {
    expect(cookieNamespaceSuffix(STAGING)).not.toBe('');
  });

  it.each([PRODUCTION, NATIVE_APP_ORIGIN, 'localhost:3003', undefined, ''])(
    'leaves %s on the shared namespace',
    (host) => {
      expect(cookieNamespaceSuffix(host)).toBe('');
    },
  );

  it('ignores the port and casing on the staging host', () => {
    expect(cookieNamespaceSuffix('DEV.xmobile.com.TM:80')).toBe(
      cookieNamespaceSuffix(STAGING),
    );
  });

  // The whole point: a name production never writes cannot be shadowed by
  // production's Secure cookie of the same name on the parent domain.
  it('gives staging names that differ from production', () => {
    expect(guestSessionCookieName(reqFor(STAGING))).not.toBe(
      guestSessionCookieName(reqFor(PRODUCTION)),
    );
    expect(authRefreshCookieName(reqFor(STAGING))).not.toBe(
      authRefreshCookieName(reqFor(PRODUCTION)),
    );
  });

  it('keeps production and the native app on the unsuffixed names', () => {
    expect(guestSessionCookieName(reqFor(PRODUCTION))).toBe(
      GUEST_SESSION_COOKIE_NAME,
    );
    // A shipped binary writes these names and cannot be redeployed in step
    // with the server.
    expect(guestSessionCookieName(reqFor(NATIVE_APP_ORIGIN))).toBe(
      GUEST_SESSION_COOKIE_NAME,
    );
    expect(authRefreshCookieName(reqFor(NATIVE_APP_ORIGIN))).toBe(
      AUTH_REFRESH_COOKIE_NAME,
    );
  });
});

describe('reading cookies on a namespaced host', () => {
  it('prefers the namespaced cookie', () => {
    const req = reqFor(STAGING);
    const cookies = {
      [GUEST_SESSION_COOKIE_NAME]: 'shared',
      [guestSessionCookieName(req)]: 'namespaced',
    };

    expect(readGuestSessionCookie(cookies, req)).toBe('namespaced');
  });

  // Rolls forward without logging anyone out: sessions issued before this
  // change, and the native wrapper's injected cookie, still resolve.
  it('falls back to the shared name', () => {
    const req = reqFor(STAGING);

    expect(
      readGuestSessionCookie({ [GUEST_SESSION_COOKIE_NAME]: 'old' }, req),
    ).toBe('old');
    expect(
      readAuthRefreshCookie({ [AUTH_REFRESH_COOKIE_NAME]: 'token' }, req),
    ).toBe('token');
  });

  it('does not read the namespaced cookie on production', () => {
    const prod = reqFor(PRODUCTION);
    const cookies = { [`${GUEST_SESSION_COOKIE_NAME}_DEV`]: 'staging-session' };

    expect(readGuestSessionCookie(cookies, prod)).toBeUndefined();
  });

  it('returns undefined when nothing is set', () => {
    expect(readGuestSessionCookie({}, reqFor(STAGING))).toBeUndefined();
    expect(readGuestSessionCookie(undefined, reqFor(STAGING))).toBeUndefined();
  });

  it('clears every name the refresh token can live under', () => {
    const names = authRefreshCookieNames(reqFor(STAGING));

    expect(names).toContain(AUTH_REFRESH_COOKIE_NAME);
    expect(names).toContain(authRefreshCookieName(reqFor(STAGING)));
  });

  it('reads through an injected client getter', () => {
    const jar: Record<string, string> = { [AUTH_REFRESH_COOKIE_NAME]: 'token' };

    expect(readAuthRefreshCookieWith((name) => jar[name])).toBe('token');
    expect(readAuthRefreshCookieWith(() => undefined)).toBeUndefined();
  });
});
