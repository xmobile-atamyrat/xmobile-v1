import { describe, expect, it } from 'vitest';

import {
  cachedPriceFrom,
  derivedDisplayFrom,
  DISPLAY_PRICE_STEP,
  displayPriceOf,
  displayPriceOrNull,
  displayTmtFromUsd,
  pricesFromUsd,
  pricesPinned,
  regularPriceOf,
  roundToDisplayTmt,
  salePercentOf,
  salePriceOf,
  tmtFromUsd,
} from '@/pages/lib/priceDisplay';

describe('roundToDisplayTmt', () => {
  it.each([
    [1282.2, 1290],
    [1282, 1290],
    [1290, 1290],
    [1291, 1300],
    [47.3, 50],
    [50, 50],
    [10, 10],
    [1, 10],
    [0, 0],
  ])('rounds %s up to %s', (input, expected) => {
    expect(roundToDisplayTmt(input)).toBe(expected);
  });

  // 50 * 19.6 is 980.0000000000001, so a bare ceil would bill 990.
  it('does not ratchet a price that lands exactly on a step', () => {
    expect(roundToDisplayTmt(tmtFromUsd(50, 19.6))).toBe(980);
    expect(displayTmtFromUsd(50, 19.6)).toBe(980);
  });

  it('is idempotent', () => {
    [0, 1, 47.3, 980, 1282.2, 1290, 1291, 99999].forEach((value) => {
      const once = roundToDisplayTmt(value);
      expect(roundToDisplayTmt(once)).toBe(once);
    });
  });

  it('composes with tmtFromUsd', () => {
    const cases: [number, number][] = [
      [65.42, 19.6],
      [50, 19.6],
      [18.88, 19.6],
      [100, 19.6],
      [0.5, 19.6],
      [1234.56, 3.5],
    ];
    cases.forEach(([usd, rate]) => {
      expect(displayTmtFromUsd(usd, rate)).toBe(roundToDisplayTmt(usd * rate));
    });
  });

  it('exposes the step it rounds to', () => {
    expect(DISPLAY_PRICE_STEP).toBe(10);
  });
});

describe('displayPriceOf', () => {
  it('returns the display price when one is stored', () => {
    expect(
      displayPriceOf({
        priceInTmt: '1282',
        displayPriceTmt: '1290',
        salePriceTmt: null,
      }),
    ).toBe('1290');
  });

  it('returns the stored string verbatim rather than reformatting it', () => {
    // A pinned price reaches the customer exactly as the admin typed it.
    expect(
      displayPriceOf({
        priceInTmt: '1282',
        displayPriceTmt: '1290.00',
        salePriceTmt: null,
      }),
    ).toBe('1290.00');
    expect(
      displayPriceOf({
        priceInTmt: '1282',
        displayPriceTmt: ' 1290 ',
        salePriceTmt: null,
      }),
    ).toBe('1290');
  });

  // The state every row is in until the dollar rate is next updated, so this is
  // what guarantees the migration moves no prices.
  it.each([
    ['null (not computed yet)', null],
    ['empty', ''],
    ['whitespace', '   '],
    ['zero', '0'],
    ['negative', '-5'],
    ['non-numeric', 'abc'],
  ])(
    'falls back to priceInTmt when the display price is %s',
    (_label, stored) => {
      expect(
        displayPriceOf({
          priceInTmt: '1282',
          displayPriceTmt: stored,
          salePriceTmt: null,
        }),
      ).toBe('1282');
    },
  );
});

describe('displayPriceOrNull', () => {
  it('passes null and undefined through', () => {
    expect(displayPriceOrNull(null)).toBeNull();
    expect(displayPriceOrNull(undefined)).toBeNull();
  });

  it('resolves a row like displayPriceOf does', () => {
    expect(
      displayPriceOrNull({
        priceInTmt: '1282',
        displayPriceTmt: '1290',
        salePriceTmt: null,
      }),
    ).toBe('1290');
  });
});

describe('write helpers', () => {
  it('pricesFromUsd derives both columns from dollars', () => {
    // 65.42 * 19.6 = 1282.232 -> 1283 whole manat -> 1290 shown.
    expect(pricesFromUsd(65.42, 19.6)).toEqual({
      priceInTmt: '1283',
      displayPriceTmt: '1290',
    });
  });

  it('pricesPinned stores a hand-typed manat price to both columns unrounded', () => {
    expect(pricesPinned('1283')).toEqual({
      priceInTmt: '1283',
      displayPriceTmt: '1283',
    });
  });

  it('a pinned price survives displayPriceOf unrounded', () => {
    expect(
      displayPriceOf({ ...pricesPinned('1283'), salePriceTmt: null }),
    ).toBe('1283');
  });
});

describe('cachedPriceFrom', () => {
  it('resolves the shown price as a number for the Product cache', () => {
    expect(
      cachedPriceFrom({
        priceInTmt: '1283',
        displayPriceTmt: '1290',
        salePriceTmt: null,
      }),
    ).toBe(1290);
  });

  it('falls back to the exact manat when nothing is stored yet', () => {
    expect(
      cachedPriceFrom({
        priceInTmt: '1283',
        displayPriceTmt: null,
        salePriceTmt: null,
      }),
    ).toBe(1283);
  });

  it('returns null when there is nothing numeric to cache', () => {
    expect(cachedPriceFrom(null)).toBeNull();
    expect(cachedPriceFrom(undefined)).toBeNull();
    expect(
      cachedPriceFrom({
        priceInTmt: 'not-a-price',
        displayPriceTmt: null,
        salePriceTmt: null,
      }),
    ).toBeNull();
  });
});

describe('derivedDisplayFrom', () => {
  it('rounds a stored manat figure up to the nearest 10', () => {
    expect(derivedDisplayFrom('1282.23')).toBe('1290');
    expect(derivedDisplayFrom('1290')).toBe('1290');
  });

  it('returns null for a figure that is not a number', () => {
    expect(derivedDisplayFrom('call for price')).toBeNull();
    expect(derivedDisplayFrom('')).toBeNull();
  });

  // Guard: an earlier revision rounded the manat when a price was created.
  it('does not touch the value it was derived from', () => {
    const priceInTmt = '1282.23';
    expect(derivedDisplayFrom(priceInTmt)).toBe('1290');
    expect(priceInTmt).toBe('1282.23');
  });
});

describe('sale prices', () => {
  const row = (
    salePriceTmt: string | null,
    displayPriceTmt: string | null = '1000',
    priceInTmt = '995',
  ) => ({ priceInTmt, displayPriceTmt, salePriceTmt });

  it('is active below the regular price and returned as stored', () => {
    expect(salePriceOf(row('900.00'))).toBe('900.00');
    expect(salePriceOf(row(' 900 '))).toBe('900');
    expect(displayPriceOf(row('900.00'))).toBe('900.00');
    expect(regularPriceOf(row('900.00'))).toBe('1000');
  });

  it.each([
    ['null', null],
    ['empty', ''],
    ['zero', '0'],
    ['negative', '-5'],
    ['non-numeric', 'abc'],
    ['exponent notation', '1e2'],
    ['a decimal comma', '90,5'],
    ['equal to the regular price', '1000'],
    ['above the regular price', '1001'],
  ])('is no sale when %s', (_label, stored) => {
    expect(salePriceOf(row(stored))).toBeNull();
    expect(salePercentOf(row(stored))).toBeNull();
    expect(displayPriceOf(row(stored))).toBe('1000');
  });

  it('compares against priceInTmt when no display price is stored', () => {
    expect(salePriceOf(row('994', null))).toBe('994');
    expect(salePriceOf(row('995', null))).toBeNull();
  });

  it('is no sale when the regular price is not a number', () => {
    expect(salePriceOf(row('5', null, 'call'))).toBeNull();
  });

  it.each([
    ['900', 10],
    // (100 - 71) / 100 is 28.999999999999996 in floating point.
    ['710', 29],
    ['895', 10],
    ['999', 1],
    ['0.5', 99],
  ])('shows %s off 1000 as %s percent', (sale, percent) => {
    expect(salePercentOf(row(sale))).toBe(percent);
  });

  it('is cached in place of the regular price', () => {
    expect(cachedPriceFrom(row('900'))).toBe(900);
    expect(cachedPriceFrom(row('1100'))).toBe(1000);
  });

  it('is left alone by the write helpers', () => {
    expect(pricesFromUsd(50, 19.6)).not.toHaveProperty('salePriceTmt');
    expect(pricesPinned('1000')).not.toHaveProperty('salePriceTmt');
  });
});
