import { describe, expect, it } from 'vitest';

import {
  AUTH_REFRESH_COOKIE_NAME,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
} from '@/pages/lib/constants';

/**
 * Smoke test: Vitest runs, `@/` resolves to `src/`, and app modules load.
 */
describe('smoke', () => {
  it('resolves path alias and reads shared constants', () => {
    expect(DEFAULT_LOCALE).toBe('ru');
    expect(LOCALE_COOKIE_NAME).toBe('NEXT_LOCALE');
    expect(AUTH_REFRESH_COOKIE_NAME).toBe('REFRESH_TOKEN');
  });
});
