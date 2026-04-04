import { describe, expect, it } from 'vitest';

import { parseName } from '@/pages/lib/utils';

describe('parseName', () => {
  it('returns empty string for missing name or locale', () => {
    expect(parseName('', 'ru')).toBe('');
    expect(parseName('{}', '')).toBe('');
  });

  it('returns the requested locale when present', () => {
    const raw = JSON.stringify({ ru: 'Ру', en: 'En' });
    expect(parseName(raw, 'en')).toBe('En');
  });

  it('falls back tk → ch → ru → en when locale missing', () => {
    expect(parseName(JSON.stringify({ ru: 'R', tk: 'T' }), 'en')).toBe('T');
    expect(parseName(JSON.stringify({ ru: 'R', ch: 'C' }), 'en')).toBe('C');
    expect(parseName(JSON.stringify({ ru: 'R' }), 'en')).toBe('R');
    expect(parseName(JSON.stringify({ en: 'E' }), 'xx')).toBe('E');
  });

  it('returns the original string when JSON.parse fails', () => {
    expect(parseName('plain text', 'ru')).toBe('plain text');
  });
});
