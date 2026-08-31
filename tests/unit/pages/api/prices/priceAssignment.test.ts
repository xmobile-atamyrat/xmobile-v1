import { describe, expect, test } from 'vitest';

import { priceAssignmentError } from '@/pages/api/prices/index.page';

const IPHONE = 'prod-iphone';
const PIXEL = 'prod-pixel';

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
