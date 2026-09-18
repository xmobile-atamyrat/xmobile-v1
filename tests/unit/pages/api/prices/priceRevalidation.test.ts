import { describe, expect, it } from 'vitest';

import { priceRevalidationProductIds } from '@/pages/api/prices/index.page';

describe('priceRevalidationProductIds', () => {
  it('includes the owner of a pair that only changed its amount', () => {
    // The product row is untouched by this edit, but its JSON-LD price and the
    // category grid that seeds it both move — so it still needs rebuilding.
    const ids = priceRevalidationProductIds(
      [{ id: 'price-1', price: '120' }],
      new Map([['price-1', { id: 'price-1', productId: 'prod-1' }]]),
    );

    expect(ids).toEqual(['prod-1']);
  });

  it('includes both the old and the new owner when a price is reassigned', () => {
    const ids = priceRevalidationProductIds(
      [{ id: 'price-1', productId: 'prod-2' }],
      new Map([['price-1', { id: 'price-1', productId: 'prod-1' }]]),
    );

    expect(new Set(ids)).toEqual(new Set(['prod-1', 'prod-2']));
  });

  it('includes the previous owner when a price is disconnected', () => {
    const ids = priceRevalidationProductIds(
      [{ id: 'price-1', productId: null }],
      new Map([['price-1', { id: 'price-1', productId: 'prod-1' }]]),
    );

    expect(ids).toEqual(['prod-1']);
  });

  it('collapses several prices belonging to the same product', () => {
    const ids = priceRevalidationProductIds(
      [
        { id: 'price-1', price: '1' },
        { id: 'price-2', price: '2' },
      ],
      new Map([
        ['price-1', { id: 'price-1', productId: 'prod-1' }],
        ['price-2', { id: 'price-2', productId: 'prod-1' }],
      ]),
    );

    expect(ids).toEqual(['prod-1']);
  });

  it('yields nothing for a price no product owns', () => {
    const ids = priceRevalidationProductIds(
      [{ id: 'price-1', price: '1' }],
      new Map([['price-1', { id: 'price-1', productId: null }]]),
    );

    expect(ids).toEqual([]);
  });
});
