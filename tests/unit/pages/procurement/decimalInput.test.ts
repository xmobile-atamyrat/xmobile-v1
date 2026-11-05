import {
  isDecimalDraft,
  parseDecimal,
} from '@/pages/procurement/lib/decimalInput';
import { describe, expect, it } from 'vitest';

describe('decimalInput', () => {
  it('accepts partial decimals with either separator', () => {
    ['', '3', '3.', '3,', '3.67', '3,67', '.5', ','].forEach((text) =>
      expect(isDecimalDraft(text)).toBe(true),
    );
    ['3a', '3.6.7', '3,6,7', '-1', '1e5', ' 3'].forEach((text) =>
      expect(isDecimalDraft(text)).toBe(false),
    );
  });

  it('parses comma and dot decimals without truncating', () => {
    expect(parseDecimal('3,67')).toBe(3.67);
    expect(parseDecimal('3.67')).toBe(3.67);
    expect(parseDecimal('3.')).toBe(3);
    expect(parseDecimal('.5')).toBe(0.5);
    expect(parseDecimal('')).toBeUndefined();
    expect(parseDecimal(',')).toBeUndefined();
    expect(parseDecimal('abc')).toBeUndefined();
  });
});
