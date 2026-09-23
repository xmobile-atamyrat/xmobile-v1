import { describe, expect, it } from 'vitest';

import {
  findDefaultRate,
  pricesAtRate,
  rateForPrice,
  recomputedPriceFields,
} from '@/lib/dollarRates';

const rate = (id: number, value: number, isDefault = false) => ({
  id,
  rate: value,
  isDefault,
});

const MANAT = rate(1, 19.5, true);
const BAZAR = rate(2, 19.8);

describe('findDefaultRate', () => {
  it('returns the flagged rate', () => {
    expect(findDefaultRate([BAZAR, MANAT])).toBe(MANAT);
  });

  it('returns null when nothing is flagged', () => {
    expect(findDefaultRate([BAZAR])).toBeNull();
  });
});

describe('rateForPrice', () => {
  it('returns the rate the price is assigned to', () => {
    expect(rateForPrice({ dollarRateId: 2 }, [MANAT, BAZAR])).toBe(BAZAR);
  });

  it('falls back to the default when the price has no rate', () => {
    expect(rateForPrice({ dollarRateId: null }, [MANAT, BAZAR])).toBe(MANAT);
  });

  // A rate deleted out from under the price leaves a dangling id in a stale
  // client cache; pricing at the default beats pricing at nothing.
  it('falls back to the default when the assigned rate is gone', () => {
    expect(rateForPrice({ dollarRateId: 99 }, [MANAT, BAZAR])).toBe(MANAT);
  });

  it('returns null when there is no assigned rate and no default', () => {
    expect(rateForPrice({ dollarRateId: null }, [BAZAR])).toBeNull();
  });
});

describe('recomputedPriceFields', () => {
  it('converts dollars at the given rate, rounding up to whole manat', () => {
    expect(recomputedPriceFields('50', 19.6)).toEqual({
      priceInTmt: '980',
      displayPriceTmt: '980',
    });
  });

  it('rounds the display price up to the nearest ten', () => {
    expect(recomputedPriceFields('50.5', 19.6)).toEqual({
      priceInTmt: '990',
      displayPriceTmt: '990',
    });
    expect(recomputedPriceFields('51', 19.6)).toEqual({
      priceInTmt: '1000',
      displayPriceTmt: '1000',
    });
  });

  // Legacy rows stored the string "NaN". Recomputing those must leave the row
  // untouched rather than write NaN back over a real manat price.
  it('returns null for a price that is not a number', () => {
    expect(recomputedPriceFields('NaN', 19.5)).toBeNull();
    expect(recomputedPriceFields('', 19.5)).toBeNull();
  });
});

describe('pricesAtRate', () => {
  it('matches only the prices assigned to a non-default rate', () => {
    expect(pricesAtRate(BAZAR)).toEqual({ dollarRateId: 2 });
  });

  // Unassigned prices follow the default rate, so editing it has to sweep them
  // up too or they keep manat figures computed at the old number forever.
  it('also matches unassigned prices when the rate is the default', () => {
    expect(pricesAtRate(MANAT)).toEqual({
      OR: [{ dollarRateId: 1 }, { dollarRateId: null }],
    });
  });
});
