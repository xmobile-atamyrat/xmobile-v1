import { describe, expect, it } from 'vitest';
import { isUUID } from '@/pages/lib/utils';

describe('isUUID', () => {
  it('returns true for a valid lowercase UUID v4', () => {
    expect(isUUID('cd256c66-4efe-487e-903e-fa73850f214a')).toBe(true);
  });

  it('returns true for a valid uppercase UUID', () => {
    expect(isUUID('CD256C66-4EFE-487E-903E-FA73850F214A')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isUUID('')).toBe(false);
  });

  it('returns false for generic string slugs', () => {
    expect(isUUID('my-cool-product')).toBe(false);
    expect(isUUID('phones')).toBe(false);
    expect(isUUID('iphone-15-pro-max')).toBe(false);
  });

  it('returns false for an invalid format resembling a UUID', () => {
    // Missing a character
    expect(isUUID('cd256c6-4efe-487e-903e-fa73850f214a')).toBe(false);
    // Invalid characters (g, h, z)
    expect(isUUID('zz256c66-4efe-487e-903e-fa73850f214a')).toBe(false);
  });
});
