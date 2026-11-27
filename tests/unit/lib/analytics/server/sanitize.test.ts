import { describe, expect, it } from 'vitest';

import {
  sanitizeString,
  sanitizeValue,
  truncateUtf16,
} from '@/lib/analytics/server/sanitize';

const isWellFormed = (s: string) =>
  !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
    s,
  );

describe('sanitizeString', () => {
  it('drops NUL characters', () => {
    expect(sanitizeString('a\u0000b\u0000')).toBe('ab');
  });

  it.each([
    ['a lone high surrogate', 'x\uD83D', 'x�'],
    ['a lone low surrogate', '\uDE00x', '�x'],
    ['two high surrogates', '\uD83D😀', '�😀'],
    ['reversed pair', '\uDE00\uD83D', '��'],
  ])('replaces %s with U+FFFD', (_label, input, expected) => {
    expect(sanitizeString(input)).toBe(expected);
    expect(isWellFormed(sanitizeString(input))).toBe(true);
  });

  it('leaves valid text, emoji and Cyrillic alone', () => {
    expect(sanitizeString('Телефон 😀 iPhone')).toBe('Телефон 😀 iPhone');
  });
});

describe('sanitizeValue', () => {
  it('cleans strings and keys at any depth, keeping other values', () => {
    expect(
      sanitizeValue({
        'k\u0000': 'v\uD800',
        n: 1,
        b: true,
        z: null,
        list: ['\u0000a', 2, { deep: '\uDC00' }],
      }),
    ).toEqual({
      k: 'v�',
      n: 1,
      b: true,
      z: null,
      list: ['a', 2, { deep: '�' }],
    });
  });

  it('passes primitives through', () => {
    expect(sanitizeValue(5)).toBe(5);
    expect(sanitizeValue(undefined)).toBeUndefined();
    expect(sanitizeValue('a\u0000')).toBe('a');
  });
});

describe('truncateUtf16', () => {
  it('cuts to max UTF-16 units', () => {
    expect(truncateUtf16('abcdef', 3)).toBe('abc');
    expect(truncateUtf16('ab', 3)).toBe('ab');
  });

  it('never splits a surrogate pair', () => {
    // 'a😀' is 3 units; cutting at 2 would leave half the emoji.
    expect(truncateUtf16('a😀b', 2)).toBe('a');
    expect(truncateUtf16('a😀b', 3)).toBe('a😀');
  });
});
