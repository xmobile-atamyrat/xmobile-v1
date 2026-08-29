// @vitest-environment jsdom

import { LOCALE_COOKIE_NAME } from '@/pages/lib/constants';
import { setCookie } from '@/pages/lib/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * jsdom stores every cookie regardless of Path, so real shadowing cannot be
 * reproduced here. Capture what we hand to the browser instead -- the emitted
 * attributes are what decide the scope.
 */
function captureCookieWrites(): string[] {
  const written: string[] = [];
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => '',
    set: (value: string) => {
      written.push(value);
    },
  });
  return written;
}

describe('setCookie', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/product-category/telefonlar');
  });

  // The reported bug: a language chosen on a subcategory page was written
  // without a Path, so the browser scoped it to /product-category. The home
  // page never received it, read the stale root-scoped NEXT_LOCALE the native
  // app had injected, and pushed the router back to `en`.
  it('scopes cookies to the whole site by default', () => {
    const written = captureCookieWrites();

    setCookie(LOCALE_COOKIE_NAME, 'tk');

    const localeWrite = written.find((entry) =>
      entry.startsWith(`${LOCALE_COOKIE_NAME}=tk`),
    );
    expect(localeWrite).toBeDefined();
    expect(localeWrite).toContain('Path=/');
    expect(localeWrite).not.toContain('Path=/product-category');
  });

  it('expires narrower copies left by the old path-less writes', () => {
    const written = captureCookieWrites();

    setCookie(LOCALE_COOKIE_NAME, 'tk');

    // One expiry per ancestor directory of the current route.
    const expiries = written.filter((entry) => entry.includes('Max-Age=0'));
    expect(
      expiries.some((entry) => entry.includes('Path=/product-category')),
    ).toBe(true);
    expect(
      expiries.some((entry) =>
        entry.includes('Path=/product-category/telefonlar'),
      ),
    ).toBe(true);
  });

  it('lets callers override the defaults', () => {
    const written = captureCookieWrites();

    setCookie('SOMETHING', 'x', { path: '/scoped', maxAge: 60 });

    const write = written.find((entry) => entry.startsWith('SOMETHING=x'));
    expect(write).toContain('Path=/scoped');
    expect(write).toContain('Max-Age=60');
  });

  it('notifies listeners so the WebView auth sync can pick the change up', () => {
    captureCookieWrites();
    const listener = vi.fn();
    window.addEventListener('cookie-change', listener);

    setCookie(LOCALE_COOKIE_NAME, 'ru');

    expect(listener).toHaveBeenCalled();
    window.removeEventListener('cookie-change', listener);
  });
});
