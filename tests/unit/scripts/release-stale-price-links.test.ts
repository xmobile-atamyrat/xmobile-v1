import { describe, expect, test } from 'vitest';

import {
  planStaleLinks,
  planStockResync,
  ProductRef,
} from '../../../scripts/release-stale-price-links';

const product = (
  overrides: Partial<ProductRef> & { id: string },
): ProductRef => ({
  price: null,
  tags: [],
  deletedAt: null,
  outOfStockAt: null,
  ...overrides,
});

describe('planStaleLinks', () => {
  test('flags a price its owner no longer references', () => {
    const plan = planStaleLinks(
      [product({ id: 'A', tags: ['128gb [kept]'] })],
      [
        { id: 'kept', productId: 'A', outOfStockAt: null },
        { id: 'stray', productId: 'A', outOfStockAt: null },
      ],
    );
    expect(plan.stale).toEqual([{ priceId: 'stray', productId: 'A' }]);
  });

  test('counts a bare-id base price as referenced', () => {
    const plan = planStaleLinks(
      [product({ id: 'A', price: 'bare' })],
      [{ id: 'bare', productId: 'A', outOfStockAt: null }],
    );
    expect(plan.stale).toEqual([]);
  });

  test('reports soft-deleted and missing owners separately', () => {
    const plan = planStaleLinks(
      [product({ id: 'gone', deletedAt: new Date(), price: '[p1]' })],
      [
        { id: 'p1', productId: 'gone', outOfStockAt: null },
        { id: 'p2', productId: 'nobody', outOfStockAt: null },
      ],
    );
    expect(plan.stale).toEqual([]);
    expect(plan.deletedOwner).toEqual([{ priceId: 'p1', productId: 'gone' }]);
    expect(plan.missingOwner).toEqual([{ priceId: 'p2', productId: 'nobody' }]);
  });

  test('counts referenced prices nobody owns, but only for active products', () => {
    const plan = planStaleLinks(
      [
        product({ id: 'A', price: '[p1]' }),
        product({ id: 'gone', deletedAt: new Date(), price: '[p2]' }),
      ],
      [
        { id: 'p1', productId: null, outOfStockAt: null },
        { id: 'p2', productId: null, outOfStockAt: null },
      ],
    );
    expect(plan.unlinkedReferenced).toBe(1);
  });
});

describe('planStockResync', () => {
  const soldOut = new Date();

  test('puts a product back in stock once its sold-out stray is gone', () => {
    // The sold-out stray was already released; what remains is in stock.
    const result = planStockResync(
      [product({ id: 'A', outOfStockAt: soldOut })],
      [{ id: 'kept', productId: 'A', outOfStockAt: null }],
      ['A'],
    );
    expect(result).toEqual({ toOutOfStock: [], toInStock: ['A'] });
  });

  test('marks a product out of stock when every remaining price is', () => {
    const result = planStockResync(
      [product({ id: 'A' })],
      [{ id: 'kept', productId: 'A', outOfStockAt: soldOut }],
      ['A'],
    );
    expect(result).toEqual({ toOutOfStock: ['A'], toInStock: [] });
  });

  test('leaves a product that owns nothing as it is', () => {
    const result = planStockResync(
      [product({ id: 'A', outOfStockAt: soldOut })],
      [],
      ['A'],
    );
    expect(result).toEqual({ toOutOfStock: [], toInStock: [] });
  });
});
