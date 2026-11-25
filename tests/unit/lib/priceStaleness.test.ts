import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  daysSince,
  productStaleness,
  staleTierFor,
  worstTier,
} from '@/lib/priceStaleness';
import {
  countStaleProducts,
  getProductStalenessMap,
} from '@/lib/priceStalenessQueries';

vi.mock('@/lib/dbClient', () => ({ default: {} }));

describe('tier boundaries', () => {
  it('maps age to a tier at the 30 and 90 day boundaries', () => {
    expect(staleTierFor(29)).toBeNull();
    expect(staleTierFor(30)).toBe('orange');
    expect(staleTierFor(89)).toBe('orange');
    expect(staleTierFor(90)).toBe('red');
  });

  it('counts whole elapsed days and clamps future dates to 0', () => {
    const now = new Date('2026-03-01T12:00:00Z');
    expect(daysSince('2026-02-01T13:00:00Z', now)).toBe(27);
    expect(daysSince('2026-04-01T00:00:00Z', now)).toBe(0);
  });
});
vi.mock('@/lib/brandProductCount', () => ({ syncBrandProductCount: vi.fn() }));

const NOW = new Date('2026-11-25T12:00:00Z');
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe('daysSince', () => {
  it('floors to whole days', () => {
    expect(daysSince(new Date(NOW.getTime() - 29.9 * 86_400_000), NOW)).toBe(
      29,
    );
  });

  it('accepts ISO strings', () => {
    expect(daysSince(ago(5).toISOString(), NOW)).toBe(5);
  });

  it('never returns a negative number', () => {
    expect(daysSince(ago(-3), NOW)).toBe(0);
  });
});

describe('staleTierFor', () => {
  it.each([
    [0, null],
    [29, null],
    [30, 'orange'],
    [89, 'orange'],
    [90, 'red'],
    [400, 'red'],
  ])('%i days -> %s', (days, tier) => {
    expect(staleTierFor(days)).toBe(tier);
  });
});

describe('worstTier', () => {
  it('picks the worst', () => {
    expect(worstTier([])).toBeNull();
    expect(worstTier([null, null])).toBeNull();
    expect(worstTier([null, 'orange'])).toBe('orange');
    expect(worstTier(['orange', 'red', null])).toBe('red');
  });
});

describe('productStaleness', () => {
  it('uses the oldest linked price and ignores missing ids', () => {
    const map = new Map([
      ['a', ago(10)],
      ['b', ago(45)],
    ]);
    expect(productStaleness(['a', 'b', 'gone'], map, NOW)).toEqual({
      tier: 'orange',
      days: 45,
    });
  });

  it('returns null tier and days when nothing is found', () => {
    expect(productStaleness(['x'], new Map(), NOW)).toEqual({
      tier: null,
      days: null,
    });
    expect(productStaleness([], new Map(), NOW)).toEqual({
      tier: null,
      days: null,
    });
  });
});

function makeDb(
  products: { id: string; price: string | null; tags: string[] }[],
  prices: { id: string; priceCheckedAt: Date }[],
) {
  const productFindMany = vi.fn().mockResolvedValue(products);
  const pricesFindMany = vi.fn().mockResolvedValue(prices);
  const db = {
    product: { findMany: productFindMany },
    prices: { findMany: pricesFindMany },
  } as unknown as PrismaClient;
  return { db, productFindMany, pricesFindMany };
}

describe('getProductStalenessMap', () => {
  it('does one prices query for all products', async () => {
    const products = [
      { id: 'p1', price: '[a]', tags: ['x[b]'] },
      { id: 'p2', price: '[a]', tags: [] },
      { id: 'p3', price: null, tags: [] },
    ];
    const { db, pricesFindMany } = makeDb(products, [
      { id: 'a', priceCheckedAt: ago(5) },
      { id: 'b', priceCheckedAt: ago(100) },
    ]);
    const map = await getProductStalenessMap(db, products, NOW);
    expect(pricesFindMany).toHaveBeenCalledTimes(1);
    expect(map.get('p1')).toEqual({ tier: 'red', days: 100 });
    expect(map.get('p2')).toEqual({ tier: null, days: 5 });
    expect(map.get('p3')).toEqual({ tier: null, days: null });
  });

  it('skips the query when there are no ids', async () => {
    const { db, pricesFindMany } = makeDb([], []);
    await getProductStalenessMap(db, [{ id: 'p', price: null, tags: [] }], NOW);
    expect(pricesFindMany).not.toHaveBeenCalled();
  });
});

describe('countStaleProducts', () => {
  it('counts each product once in its worst bucket', async () => {
    const { db, productFindMany } = makeDb(
      [
        { id: 'p1', price: '[a]', tags: ['t[b]'] },
        { id: 'p2', price: '[c]', tags: [] },
        { id: 'p3', price: '[d]', tags: [] },
      ],
      [
        { id: 'a', priceCheckedAt: ago(40) },
        { id: 'b', priceCheckedAt: ago(95) },
        { id: 'c', priceCheckedAt: ago(31) },
        { id: 'd', priceCheckedAt: ago(1) },
      ],
    );
    await expect(countStaleProducts(db, NOW)).resolves.toEqual({
      orange: 1,
      red: 1,
    });
    expect(productFindMany).toHaveBeenCalledWith({
      where: { deletedAt: null, outOfStockAt: null },
      select: { id: true, price: true, tags: true },
    });
  });
});
