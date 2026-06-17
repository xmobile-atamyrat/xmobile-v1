import { describe, expect, it } from 'vitest';

import { deriveVariantColumns } from '@/pages/api/product/index.page';

describe('deriveVariantColumns', () => {
  it('returns empty colors array for empty tags input', () => {
    expect(deriveVariantColumns([])).toEqual({ colors: [] });
  });

  it('returns empty colors array when no tags contain a color ref', () => {
    expect(deriveVariantColumns(['128gb [price-1]', 'plain spec'])).toEqual({
      colors: [],
    });
  });

  it('extracts a single colorId from one tag', () => {
    const result = deriveVariantColumns(['128gb [price-1]{color-abc}']);
    expect(result.colors).toEqual(['color-abc']);
  });

  it('extracts colorIds from multiple tags with colors', () => {
    const tags = ['128gb [price-1]{color-a}', '256gb [price-2]{color-b}'];
    const result = deriveVariantColumns(tags);
    expect(result.colors).toContain('color-a');
    expect(result.colors).toContain('color-b');
    expect(result.colors).toHaveLength(2);
  });

  it('deduplicates repeated colorIds across tags', () => {
    const tags = ['128gb [price-1]{color-x}', '64gb [price-2]{color-x}'];
    const result = deriveVariantColumns(tags);
    expect(result.colors).toEqual(['color-x']);
  });

  it('handles a mix of tagged and plain tags, returning only color refs', () => {
    const tags = [
      '128gb [price-1]{color-a}',
      'no refs here',
      '256gb [price-2]',
      '512gb {color-b}',
    ];
    const result = deriveVariantColumns(tags);
    expect(result.colors).toContain('color-a');
    expect(result.colors).toContain('color-b');
    expect(result.colors).toHaveLength(2);
  });
});
