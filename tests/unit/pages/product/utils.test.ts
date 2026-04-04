import { Prices } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  debounce,
  isPriceValid,
  parsePrice,
  processPrices,
} from '@/pages/product/utils';

describe('parsePrice', () => {
  it('rounds to two decimal places as a number', () => {
    expect(parsePrice('10.999')).toBe(11);
    expect(parsePrice('3.141')).toBe(3.14);
  });

  it('returns 0 for null-like input used at runtime', () => {
    expect(parsePrice(null as unknown as string)).toBe(0);
  });
});

describe('isPriceValid', () => {
  it('accepts integer and decimal strings', () => {
    expect(isPriceValid('0')).toBe(true);
    expect(isPriceValid('12')).toBe(true);
    expect(isPriceValid('12.5')).toBe(true);
  });

  it('rejects empty and non-numeric strings', () => {
    expect(isPriceValid('')).toBe(false);
    expect(isPriceValid('abc')).toBe(false);
    expect(isPriceValid('1a')).toBe(false);
  });
});

describe('processPrices', () => {
  it('builds header row and maps price fields', () => {
    const rows: Prices[] = [
      {
        id: 'p1',
        name: 'A',
        price: '10',
        priceInTmt: '35.50',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Prices,
    ];
    const table = processPrices(rows);
    expect(table[0]).toEqual(['Name', 'Dollars', 'Manat', 'ID']);
    expect(table[1]).toEqual(['A', '10', 35.5, 'p1']);
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('invokes the function only after delay and collapses rapid calls', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);

    d(1);
    d(2);
    d(3);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });
});
