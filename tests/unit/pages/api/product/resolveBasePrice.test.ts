import { resolveBasePrice } from '@/pages/api/product/admin-list.page';
import { describe, expect, it } from 'vitest';

const catalog = new Map([['price-1', '4200']]);

describe('resolveBasePrice', () => {
  it('resolves a catalog reference to its manat value', () => {
    expect(resolveBasePrice('[price-1]', catalog)).toEqual({
      basePriceTmt: '4200',
      basePriceIssue: null,
    });
  });

  it('flags a product that never got a price', () => {
    expect(resolveBasePrice(null, catalog)).toEqual({
      basePriceTmt: null,
      basePriceIssue: 'noPrice',
    });
  });

  it('treats an empty or whitespace-only price as no price', () => {
    expect(resolveBasePrice('', catalog).basePriceIssue).toBe('noPrice');
    expect(resolveBasePrice('   ', catalog).basePriceIssue).toBe('noPrice');
  });

  it('flags a reference whose price row is gone', () => {
    // The storefront renders this as a spinner that never resolves, so it has
    // to be distinguishable from simply having no price.
    expect(resolveBasePrice('[deleted-price]', catalog)).toEqual({
      basePriceTmt: null,
      basePriceIssue: 'danglingRef',
    });
  });

  it('shows a legacy inline price as stored, without flagging it', () => {
    // Predates the price catalog: there is nothing to look up and nothing
    // broken, so it is neither resolved nor reported.
    expect(resolveBasePrice('1500', catalog)).toEqual({
      basePriceTmt: '1500',
      basePriceIssue: null,
    });
  });

  it('reads the id out of a reference carrying a cached value', () => {
    // Stored as "[priceId]{cachedTmt}" in some rows; the id is still the part
    // that matters and the cached tail must not defeat the lookup.
    expect(resolveBasePrice('[price-1]{4200}', catalog)).toEqual({
      basePriceTmt: '4200',
      basePriceIssue: null,
    });
  });
});
