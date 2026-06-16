import { Color, Prices } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  debounce,
  isPriceValid,
  parseOrderVariant,
  parsePrice,
  parseVariantTag,
  processPrices,
  resolveVariantDisplay,
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

// ── Variant tag parsing ──────────────────────────────────────────────────────

describe('parseVariantTag', () => {
  it('extracts specText, priceId, and colorId from a full tag', () => {
    const result = parseVariantTag('128gb storage 12gb ram [price-1]{color-1}');
    expect(result.specText).toBe('128gb storage 12gb ram');
    expect(result.priceId).toBe('price-1');
    expect(result.colorId).toBe('color-1');
  });

  it('extracts only priceId when there is no color ref', () => {
    const result = parseVariantTag('256gb [price-2]');
    expect(result.specText).toBe('256gb');
    expect(result.priceId).toBe('price-2');
    expect(result.colorId).toBeUndefined();
  });

  it('extracts only colorId when there is no price ref', () => {
    const result = parseVariantTag('blue {color-3}');
    expect(result.specText).toBe('blue');
    expect(result.priceId).toBeUndefined();
    expect(result.colorId).toBe('color-3');
  });

  it('returns the full text as specText when no refs are present', () => {
    const result = parseVariantTag('plain spec text');
    expect(result.specText).toBe('plain spec text');
    expect(result.priceId).toBeUndefined();
    expect(result.colorId).toBeUndefined();
  });

  it('returns empty specText and undefined refs for an empty string', () => {
    const result = parseVariantTag('');
    expect(result.specText).toBe('');
    expect(result.priceId).toBeUndefined();
    expect(result.colorId).toBeUndefined();
  });

  it('collapses whitespace left after stripping refs', () => {
    const result = parseVariantTag('  128gb  [price-1]  {color-1}  ');
    expect(result.specText).toBe('128gb');
  });
});

describe('resolveVariantDisplay', () => {
  function fakeColor(id: string, hex: string, name: string): Color {
    return {
      id,
      name,
      hex,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Color;
  }

  it('resolves spec, colorHex, and colorName when colorId is in the map', () => {
    const map = new Map([['c1', fakeColor('c1', '#ff0000', 'Red')]]);
    const result = resolveVariantDisplay('128gb [p1]{c1}', map);
    expect(result.spec).toBe('128gb');
    expect(result.colorHex).toBe('#ff0000');
    expect(result.colorName).toBe('Red');
  });

  it('returns undefined color fields when colorId is not in the map', () => {
    const result = resolveVariantDisplay('128gb [p1]{unknown}', new Map());
    expect(result.spec).toBe('128gb');
    expect(result.colorHex).toBeUndefined();
    expect(result.colorName).toBeUndefined();
  });

  it('returns undefined color fields when the tag has no color ref', () => {
    const map = new Map([['c1', fakeColor('c1', '#ff0000', 'Red')]]);
    const result = resolveVariantDisplay('128gb [p1]', map);
    expect(result.colorHex).toBeUndefined();
    expect(result.colorName).toBeUndefined();
  });
});

describe('parseOrderVariant', () => {
  it('parses a valid JSON snapshot with all fields', () => {
    const raw = JSON.stringify({
      spec: '128gb',
      colorHex: '#ff0000',
      colorName: 'Red',
    });
    const result = parseOrderVariant(raw);
    expect(result.spec).toBe('128gb');
    expect(result.colorHex).toBe('#ff0000');
    expect(result.colorName).toBe('Red');
  });

  it('converts null colorHex and colorName to undefined', () => {
    const raw = JSON.stringify({
      spec: '64gb',
      colorHex: null,
      colorName: null,
    });
    const result = parseOrderVariant(raw);
    expect(result.spec).toBe('64gb');
    expect(result.colorHex).toBeUndefined();
    expect(result.colorName).toBeUndefined();
  });

  it('falls back to plain-text spec for legacy non-JSON strings', () => {
    const result = parseOrderVariant('old plain spec');
    expect(result).toEqual({ spec: 'old plain spec' });
  });

  it('falls back to plain-text spec for malformed JSON', () => {
    const result = parseOrderVariant('{broken json');
    expect(result).toEqual({ spec: '{broken json' });
  });

  it('falls back to plain-text when JSON is valid but missing spec string', () => {
    const result = parseOrderVariant(JSON.stringify({ colorHex: '#fff' }));
    expect(result.spec).toBe(JSON.stringify({ colorHex: '#fff' }));
  });
});
