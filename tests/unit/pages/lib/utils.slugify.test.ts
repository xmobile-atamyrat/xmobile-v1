import { describe, expect, it } from 'vitest';

import { slugify } from '@/pages/lib/utils';

describe('slugify', () => {
  it('handles standard English names', () => {
    expect(slugify('Apple iPhone 13 Pro')).toBe('apple-iphone-13-pro');
    expect(slugify(' Samsung Galaxy  -- S23')).toBe('samsung-galaxy-s23');
    expect(slugify('Galaxy S8')).toBe('galaxy-s8');
  });

  it('normalises Turkmen diacritics via NFD (no manual map needed)', () => {
    expect(slugify('Ýetir')).toBe('yetir');
    expect(slugify('şöhle')).toBe('sohle');
    expect(slugify('Ň Ä Ö Ü Ç Ž')).toBe('n-a-o-u-c-z');
  });

  it('strips Cyrillic characters (no mapping: they are not Latin)', () => {
    expect(slugify('Телефон')).toBe('');
    expect(slugify('Телефон 123')).toBe('123');
  });

  it('handles mixed English + other characters', () => {
    expect(slugify('iPhone 14 Про')).toBe('iphone-14');
    expect(slugify('Samsung Галакси S23')).toBe('samsung-s23');
  });

  it('strips symbols leaving only alphanumeric slug', () => {
    expect(slugify('100% <!>')).toBe('100');
    expect(slugify('Hello!')).toBe('hello');
  });

  it('returns empty string when all characters are invalid', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('---')).toBe('');
    expect(slugify('Телефон')).toBe('');
  });

  it('collapses multiple spaces and hyphens into a single hyphen', () => {
    expect(slugify('a   b')).toBe('a-b');
    expect(slugify('a - - b')).toBe('a-b');
  });

  it('trims trailing hyphens', () => {
    const result = slugify('hello-');
    expect(result).not.toMatch(/-$/);
  });

  it('does NOT truncate slugs (truncation should be handled by validation)', () => {
    const longInput = 'a'.repeat(150);
    expect(slugify(longInput)).toHaveLength(150);
  });

  it('respects empty / falsy input', () => {
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
  });
});
