import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPricesFindMany } = vi.hoisted(() => ({
  mockPricesFindMany: vi.fn(),
}));

vi.mock('@/lib/dbClient', () => ({
  default: { prices: { findMany: mockPricesFindMany } },
}));

import { unavailableVariantTags, variantPriceId } from '@/lib/variantStock';

describe('variantPriceId', () => {
  it('pulls the price reference out of a variant tag', () => {
    expect(variantPriceId('128gb 12gb ram [price-1]{color-1}')).toBe('price-1');
  });

  it('returns null for a tag with no reference, and for no tag at all', () => {
    expect(variantPriceId('128gb 12gb ram')).toBeNull();
    expect(variantPriceId(null)).toBeNull();
    expect(variantPriceId(undefined)).toBeNull();
  });
});

describe('unavailableVariantTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores lines that carry no variant at all', async () => {
    const result = await unavailableVariantTags([null, undefined]);

    expect(result.size).toBe(0);
    expect(mockPricesFindMany).not.toHaveBeenCalled();
  });

  it('flags a variant with no price reference without querying', async () => {
    // Nothing to look up, and nothing to charge for it either.
    const result = await unavailableVariantTags(['no reference here', null]);

    expect([...result]).toEqual(['no reference here']);
    expect(mockPricesFindMany).not.toHaveBeenCalled();
  });

  it('asks for every referenced price in one query and flags the sold-out one', async () => {
    // Asks which prices are sellable, not which are sold out: a deleted price
    // is absent either way, and only this direction tells the two apart.
    mockPricesFindMany.mockResolvedValue([{ id: 'price-1' }]);

    const result = await unavailableVariantTags([
      'a [price-1]{c1}',
      'b [price-2]{c2}',
      null,
    ]);

    expect(mockPricesFindMany).toHaveBeenCalledTimes(1);
    expect(mockPricesFindMany).toHaveBeenCalledWith({
      where: { id: { in: ['price-1', 'price-2'] }, isOutOfStock: false },
      select: { id: true },
    });
    expect([...result]).toEqual(['b [price-2]{c2}']);
  });

  it('flags a variant whose price row no longer exists', async () => {
    // The hole this closes: a deleted price used to pass the order guard,
    // because the sold-out query could never return a row that is gone.
    mockPricesFindMany.mockResolvedValue([]);

    const result = await unavailableVariantTags(['a [deleted]{c1}']);

    expect([...result]).toEqual(['a [deleted]{c1}']);
  });

  it('returns nothing when every referenced price is sellable', async () => {
    mockPricesFindMany.mockResolvedValue([
      { id: 'price-1' },
      { id: 'price-2' },
    ]);

    const result = await unavailableVariantTags([
      'a [price-1]{c1}',
      'b [price-2]{c2}',
    ]);

    expect(result.size).toBe(0);
  });

  it('asks about a shared price once and flags every tag using it', async () => {
    mockPricesFindMany.mockResolvedValue([]);

    const result = await unavailableVariantTags([
      'black [price-1]{c1}',
      'white [price-1]{c2}',
    ]);

    expect(mockPricesFindMany).toHaveBeenCalledWith({
      where: { id: { in: ['price-1'] }, isOutOfStock: false },
      select: { id: true },
    });
    expect([...result]).toEqual(['black [price-1]{c1}', 'white [price-1]{c2}']);
  });
});
