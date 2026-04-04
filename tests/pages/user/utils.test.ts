import { describe, expect, it } from 'vitest';

import { emailCheck, passwordCheck } from '@/pages/user/utils';

describe('passwordCheck', () => {
  it('returns undefined when all rules pass', () => {
    expect(passwordCheck('Aa1!aaaa')).toBeUndefined();
  });

  it('reports shortPassword when length < 8', () => {
    expect(passwordCheck('Aa1!')).toBe('shortPassword');
  });

  it('prioritizes missing rules in declaration order (last assignment wins for multiple failures)', () => {
    expect(passwordCheck('short')).toBe('shortPassword');
    expect(passwordCheck('longenough')).toBe('hasUpperCase');
    expect(passwordCheck('LONGENOUGH1')).toBe('hasSpecial');
    expect(passwordCheck('Longenough!')).toBe('hasDigit');
  });
});

describe('emailCheck', () => {
  it('returns undefined for a plausible email', () => {
    expect(emailCheck('a@b.co')).toBeUndefined();
  });

  it('returns errorEmailInput when empty', () => {
    expect(emailCheck('')).toBe('errorEmailInput');
  });

  it('returns errorInvalidEmail for bad shape', () => {
    expect(emailCheck('not-an-email')).toBe('errorInvalidEmail');
  });
});
