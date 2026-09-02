import { describe, expect, test } from 'vitest';

import {
  priceAssignmentError,
  pricesWhere,
} from '@/pages/api/prices/index.page';

const IPHONE = 'prod-iphone';
const PIXEL = 'prod-pixel';
const PHONES = 'cat-phones';

describe('priceAssignmentError', () => {
  test('allows connecting a price that no product owns', () => {
    expect(priceAssignmentError({ productId: null }, IPHONE)).toBeNull();
  });

  test('allows disconnecting a price from its owner', () => {
    expect(priceAssignmentError({ productId: IPHONE }, null)).toBeNull();
  });

  test('allows a no-op reassignment to the current owner', () => {
    expect(priceAssignmentError({ productId: IPHONE }, IPHONE)).toBeNull();
  });

  test('rejects stealing a price owned by another product', () => {
    expect(priceAssignmentError({ productId: IPHONE }, PIXEL)).toMatch(
      /already connected/i,
    );
  });

  test('allows disconnecting a price that was already unowned', () => {
    expect(priceAssignmentError({ productId: null }, null)).toBeNull();
  });
});

describe('pricesWhere', () => {
  test('no filters matches everything', () => {
    expect(pricesWhere({})).toEqual({});
  });

  test('categoryId also admits prices with no category', () => {
    expect(pricesWhere({ categoryId: PHONES })).toEqual({
      AND: [{ OR: [{ categoryId: PHONES }, { categoryId: null }] }],
    });
  });

  test('an empty categoryId is not a filter', () => {
    expect(pricesWhere({ categoryId: '' })).toEqual({});
  });

  test('keeps the category filter out of the searchKeyword OR', () => {
    const where = pricesWhere({ categoryId: PHONES, searchKeyword: 'pro' });
    // Two sibling ORs would overwrite each other, dropping the category scope
    // and offering the whole price list to the picker.
    expect(where.AND).toEqual([
      { OR: [{ categoryId: PHONES }, { categoryId: null }] },
    ]);
    expect(where.OR).toHaveLength(3);
  });

  test('productId wins over unassigned', () => {
    expect(pricesWhere({ productId: IPHONE, unassigned: 'true' })).toEqual({
      productId: IPHONE,
    });
  });

  test('unassigned scopes to prices no product owns', () => {
    expect(pricesWhere({ unassigned: 'true' })).toEqual({ productId: null });
  });
});
