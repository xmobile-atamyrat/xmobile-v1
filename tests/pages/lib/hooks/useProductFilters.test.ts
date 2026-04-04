import { describe, expect, it } from 'vitest';

import { normalizeQueryStringArray } from '@/pages/lib/hooks/useProductFilters';

describe('normalizeQueryStringArray', () => {
  it('returns empty array for undefined', () => {
    expect(normalizeQueryStringArray(undefined)).toEqual([]);
  });

  it('wraps a single string', () => {
    expect(normalizeQueryStringArray('a')).toEqual(['a']);
  });

  it('returns the same array when already an array', () => {
    expect(normalizeQueryStringArray(['x', 'y'])).toEqual(['x', 'y']);
  });
});
