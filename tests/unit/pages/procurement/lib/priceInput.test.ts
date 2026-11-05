import {
  formatAmount,
  matchesFilter,
  parsePriceInput,
  priceToInput,
  sanitizePriceInput,
  summarizePrices,
} from '@/pages/procurement/lib/priceInput';
import { HistoryPrice } from '@/pages/procurement/lib/types';
import { priceHash } from '@/pages/procurement/lib/utils';
import { describe, expect, it } from 'vitest';

describe('parsePriceInput', () => {
  it('keeps decimals (the old parseInt turned 3.67 into 3)', () => {
    expect(parsePriceInput('3.67')).toBe(3.67);
    expect(parsePriceInput('1200')).toBe(1200);
  });

  it('accepts a comma as the decimal separator', () => {
    expect(parsePriceInput('3,67')).toBe(3.67);
    expect(parsePriceInput('0,5')).toBe(0.5);
  });

  it('treats a trailing or leading separator as a number in progress', () => {
    expect(parsePriceInput('3,')).toBe(3);
    expect(parsePriceInput(',5')).toBe(0.5);
  });

  it('returns null for an empty field (price cleared)', () => {
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput('   ')).toBeNull();
  });

  it('returns undefined when there is nothing to save yet', () => {
    expect(parsePriceInput('.')).toBeUndefined();
    expect(parsePriceInput(',')).toBeUndefined();
    expect(parsePriceInput('abc')).toBeUndefined();
  });

  it('ignores spaces and stray characters', () => {
    expect(parsePriceInput('1 250,5')).toBe(1250.5);
    expect(parsePriceInput('$12.5')).toBe(12.5);
  });
});

describe('sanitizePriceInput', () => {
  it('keeps digits and only the first separator, as typed', () => {
    expect(sanitizePriceInput('3,67')).toBe('3,67');
    expect(sanitizePriceInput('3.6.7')).toBe('3.67');
    expect(sanitizePriceInput('3,6.7')).toBe('3,67');
    expect(sanitizePriceInput('-12a')).toBe('12');
  });
});

describe('priceToInput / formatAmount', () => {
  it('shows stored numbers as plain text and nothing for missing prices', () => {
    expect(priceToInput(3.67)).toBe('3.67');
    expect(priceToInput(null)).toBe('');
    expect(priceToInput(undefined)).toBe('');
  });

  it('formats totals with grouping and at most two decimals', () => {
    expect(formatAmount(1234.567)).toBe('1,234.57');
    expect(formatAmount(0.1 + 0.2)).toBe('0.3');
  });
});

describe('summarizePrices', () => {
  const orderId = 'o1';
  const key = (productId: string, supplierId: string) =>
    priceHash({ orderId, productId, supplierId });
  const prices: HistoryPrice = {
    [key('p1', 's1')]: { value: 10.5, color: 'green' },
    [key('p1', 's2')]: { value: 12, color: 'orange' },
    [key('p2', 's1')]: { value: 3, color: 'white' },
    // p2/s2 missing
    [key('p3', 's1')]: { value: 1, color: 'green' }, // p3 not ordered
  };
  const summary = summarizePrices({
    orderId,
    productIds: ['p1', 'p2', 'p3'],
    supplierIds: ['s1', 's2'],
    prices,
    quantities: { p1: 2, p2: 1, p3: 0 },
  });

  it('counts filled cells of ordered products only', () => {
    expect(summary.filled).toBe(3);
    expect(summary.total).toBe(4);
  });

  it('sums quantity x price over green cells of ordered products', () => {
    expect(summary.chosenCount).toBe(1);
    expect(summary.chosenTotal).toBe(21);
  });

  it('feeds the filter chips', () => {
    expect([...summary.missingProductIds]).toEqual(['p2']);
    expect(matchesFilter('missing', 'p2', summary)).toBe(true);
    expect(matchesFilter('missing', 'p1', summary)).toBe(false);
    expect(matchesFilter('chosen', 'p1', summary)).toBe(true);
    expect(matchesFilter('chosen', 'p2', summary)).toBe(false);
    expect(matchesFilter('all', 'p2', summary)).toBe(true);
  });

  it('treats a cleared (null) price as missing', () => {
    const cleared = summarizePrices({
      orderId,
      productIds: ['p1'],
      supplierIds: ['s1'],
      prices: { [key('p1', 's1')]: { value: null, color: 'green' } },
      quantities: { p1: 1 },
    });
    expect(cleared.filled).toBe(0);
    expect(cleared.chosenCount).toBe(0);
    expect(cleared.missingProductIds.has('p1')).toBe(true);
  });
});
