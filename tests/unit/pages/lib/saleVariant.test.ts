import {
  basePriceIdOf,
  canQuickAddAtPrice,
  pickDefaultVariant,
  quickAddTagOf,
  SaleVariantChoice,
  variantSaleOf,
} from '@/pages/lib/saleVariant';
import { describe, expect, it } from 'vitest';

type Choice = SaleVariantChoice & { name: string };

const variant = (
  name: string,
  priceId: string,
  percent: number | null = null,
  isOutOfStock = false,
): Choice => ({
  name,
  priceId,
  isOutOfStock,
  sale: percent == null ? null : { oldPrice: '100', percent },
});

const picked = (variants: Choice[], basePriceId?: string) =>
  pickDefaultVariant(variants, basePriceId)?.name;

describe('pickDefaultVariant', () => {
  it('prefers the variant on sale at the base price', () => {
    expect(
      picked(
        [
          variant('first', 'p1', 50),
          variant('base', 'p2', 5),
          variant('big', 'p3', 70),
        ],
        'p2',
      ),
    ).toBe('base');
  });

  it('takes the first buyable colour of the base price', () => {
    expect(
      picked(
        [
          variant('soldOut', 'p1', 10, true),
          variant('buyable', 'p1', 10),
          variant('other', 'p2', 80),
        ],
        'p1',
      ),
    ).toBe('buyable');
  });

  it('keeps the first in-stock variant when it is on sale', () => {
    expect(
      picked(
        [
          variant('soldOut', 'p1', null, true),
          variant('first', 'p2', 5),
          variant('big', 'p3', 70),
        ],
        'p1',
      ),
    ).toBe('first');
  });

  it('otherwise takes the biggest in-stock discount, earliest on a tie', () => {
    expect(
      picked(
        [
          variant('base', 'p1'),
          variant('small', 'p2', 10),
          variant('big', 'p3', 30),
          variant('sameAsBig', 'p4', 30),
          variant('soldOut', 'p5', 90, true),
        ],
        'p1',
      ),
    ).toBe('big');
  });

  it('ignores a sale on a sold-out base variant', () => {
    expect(
      picked([variant('base', 'p1', 40, true), variant('plain', 'p2')], 'p1'),
    ).toBe('plain');
  });

  it('falls back to the first in-stock variant without any sale', () => {
    expect(
      picked([variant('soldOut', 'p1', null, true), variant('next', 'p2')]),
    ).toBe('next');
  });

  it('falls back to the first variant when all are sold out', () => {
    expect(
      picked(
        [variant('first', 'p1', null, true), variant('sale', 'p2', 20, true)],
        'p2',
      ),
    ).toBe('first');
  });

  it('returns nothing for no variants', () => {
    expect(pickDefaultVariant([], 'p1')).toBeUndefined();
  });
});

describe('basePriceIdOf', () => {
  it('reads the id of a stored product price', () => {
    expect(basePriceIdOf('[p1]{100}')).toBe('p1');
    expect(basePriceIdOf('100')).toBeUndefined();
    expect(basePriceIdOf(null)).toBeUndefined();
  });
});

describe('quickAddTagOf', () => {
  const tags = ['64gb [p1]{red}', '128gb [p2]{red}', '128gb [p2]{blue}'];

  it('picks the first tag priced like the base', () => {
    expect(quickAddTagOf(tags, '[p2]{100}')).toBe('128gb [p2]{red}');
  });

  it('falls back to the first tag', () => {
    expect(quickAddTagOf(tags, '[unknown]{100}')).toBe(tags[0]);
    expect(quickAddTagOf(tags, '100')).toBe(tags[0]);
  });

  it('returns nothing without tags', () => {
    expect(quickAddTagOf([], '[p1]')).toBeUndefined();
    expect(quickAddTagOf(undefined, '[p1]')).toBeUndefined();
  });
});

describe('canQuickAddAtPrice', () => {
  const tags = ['64gb [p1]{red}', '128gb [p2]{red}'];

  it('allows a price one of the tags is sold at', () => {
    expect(canQuickAddAtPrice(tags, '[p2]{100}')).toBe(true);
  });

  it('allows a product without variants', () => {
    expect(canQuickAddAtPrice([], '[p1]{100}')).toBe(true);
    expect(canQuickAddAtPrice(undefined, '[p1]{100}')).toBe(true);
  });

  it('refuses a price no tag is sold at', () => {
    expect(canQuickAddAtPrice(tags, '[base]{100}')).toBe(false);
    expect(canQuickAddAtPrice(['64gb'], '100')).toBe(false);
  });
});

describe('variantSaleOf', () => {
  const row = {
    priceInTmt: '995',
    displayPriceTmt: '1000',
    salePriceTmt: '800',
  };

  it('gives the normal price and the percent off', () => {
    expect(variantSaleOf(row)).toEqual({ oldPrice: '1000', percent: 20 });
  });

  it('is null without an active sale', () => {
    expect(variantSaleOf({ ...row, salePriceTmt: null })).toBeNull();
    expect(variantSaleOf({ ...row, salePriceTmt: '1000' })).toBeNull();
    expect(variantSaleOf(null)).toBeNull();
  });
});
