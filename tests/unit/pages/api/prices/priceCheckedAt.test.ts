import { describe, expect, test } from 'vitest';

import { priceAmountsChanged } from '@/pages/api/prices/priceCheckedAt';

const stored = { price: '10', priceInTmt: '350' };

describe('priceAmountsChanged', () => {
  test('same values are unchanged', () => {
    expect(
      priceAmountsChanged({ price: '10', priceInTmt: '350' }, stored),
    ).toBe(false);
  });

  test('numerically equal strings are unchanged', () => {
    expect(priceAmountsChanged({ price: '10.00' }, stored)).toBe(false);
    expect(priceAmountsChanged({ priceInTmt: '350.0' }, stored)).toBe(false);
  });

  test('surrounding whitespace is ignored', () => {
    expect(priceAmountsChanged({ price: ' 10 ' }, stored)).toBe(false);
  });

  test('a changed USD price is a change', () => {
    expect(priceAmountsChanged({ price: '11' }, stored)).toBe(true);
  });

  test('a changed manat price is a change', () => {
    expect(priceAmountsChanged({ priceInTmt: '360' }, stored)).toBe(true);
  });

  test('absent or null fields are unchanged', () => {
    expect(priceAmountsChanged({}, stored)).toBe(false);
    expect(priceAmountsChanged({ price: null, priceInTmt: null }, stored)).toBe(
      false,
    );
  });

  test('a manat figure that only follows a new rate is unchanged', () => {
    expect(
      priceAmountsChanged({ price: '10', priceInTmt: '200' }, stored, '200'),
    ).toBe(false);
    expect(priceAmountsChanged({ priceInTmt: '200.0' }, stored, '200')).toBe(
      false,
    );
  });

  test('a rate move with a typed manat figure or new USD is a change', () => {
    expect(priceAmountsChanged({ priceInTmt: '210' }, stored, '200')).toBe(
      true,
    );
    expect(
      priceAmountsChanged({ price: '12', priceInTmt: '240' }, stored, '240'),
    ).toBe(true);
  });

  test('a display-only change is unchanged', () => {
    expect(
      priceAmountsChanged(
        { displayPriceTmt: '399' } as Record<string, string>,
        stored,
      ),
    ).toBe(false);
  });
});
