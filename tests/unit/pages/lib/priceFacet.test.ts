import {
  formatTmt,
  priceFacet,
  priceRangeLabel,
  roundNice,
} from '@/pages/lib/priceFacet';
import { describe, expect, it } from 'vitest';

describe('roundNice', () => {
  it.each([
    [18743, 19000],
    [1234, 1200],
    [987, 990],
    [149, 150],
    [44, 40],
    [3, 10],
  ])('%d -> %d', (value, nice) => {
    expect(roundNice(value)).toBe(nice);
  });
});

describe('priceFacet', () => {
  it('returns null when nothing has a price', () => {
    expect(priceFacet([])).toBeNull();
    expect(priceFacet([0, NaN])).toBeNull();
  });

  it('spans the cheapest to the dearest product', () => {
    expect(priceFacet([5000, 1200, 24000])).toMatchObject({
      min: 1200,
      max: 24000,
    });
  });

  it('offers no brackets for a handful of products', () => {
    expect(priceFacet([100, 200, 300])?.buckets).toEqual([]);
  });

  it('cuts brackets at rounded quartiles, open at both ends', () => {
    const prices = [
      150, 300, 450, 980, 1240, 2100, 3300, 5200, 8800, 12400, 18900, 24000,
    ];
    const facet = priceFacet(prices)!;

    expect(facet.buckets.map(({ min, max }) => [min, max])).toEqual([
      [null, 980],
      [980, 3300],
      [3300, 12000],
      [12000, null],
    ]);
    expect(facet.buckets.map(({ count }) => count)).toEqual([4, 4, 3, 3]);
  });

  it('drops brackets that would collapse when prices bunch up', () => {
    const facet = priceFacet([1000, 1000, 1000, 1000, 1000, 9000])!;
    expect(facet.buckets).toEqual([]);
  });
});

describe('labels', () => {
  it('groups thousands with spaces', () => {
    expect(formatTmt(12500)).toBe('12 500');
    expect(formatTmt(980)).toBe('980');
  });

  it('reads the same in every language', () => {
    expect(priceRangeLabel(null, 3000)).toBe('0 – 3 000');
    expect(priceRangeLabel(3000, 9000)).toBe('3 000 – 9 000');
    expect(priceRangeLabel(9000, null)).toBe('9 000+');
  });
});
