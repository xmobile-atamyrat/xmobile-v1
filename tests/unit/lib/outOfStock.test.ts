import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockProductUpdateMany,
  mockProductFindMany,
  mockPricesUpdateMany,
  mockPricesFindMany,
  mockBannerFindMany,
  mockCartItemDeleteMany,
  mockTransaction,
  mockSyncBrandProductCount,
} = vi.hoisted(() => ({
  mockProductUpdateMany: vi.fn(),
  mockProductFindMany: vi.fn(),
  mockPricesUpdateMany: vi.fn(),
  mockPricesFindMany: vi.fn(),
  mockBannerFindMany: vi.fn(),
  mockCartItemDeleteMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockSyncBrandProductCount: vi.fn(),
}));

vi.mock('@/lib/dbClient', () => ({
  default: {
    product: {
      updateMany: mockProductUpdateMany,
      findMany: mockProductFindMany,
    },
    prices: { updateMany: mockPricesUpdateMany, findMany: mockPricesFindMany },
    promoBanner: { findMany: mockBannerFindMany },
    cartItem: { deleteMany: mockCartItemDeleteMany },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/lib/brandProductCount', () => ({
  syncBrandProductCount: mockSyncBrandProductCount,
}));

import {
  deriveProductOutOfStock,
  initialOutOfStockFields,
  outOfStockCascade,
  retireLongOutOfStockProducts,
  setProductOutOfStock,
  syncAllProductsOutOfStock,
  syncProductOutOfStockFromPrices,
} from '@/lib/outOfStock';

const PRODUCT = 'prod-iphone';

describe('deriveProductOutOfStock', () => {
  it('derives nothing for a product with no connected prices', () => {
    expect(deriveProductOutOfStock([])).toBeNull();
  });

  it('is out of stock only when every price is', () => {
    expect(
      deriveProductOutOfStock([{ isOutOfStock: true }, { isOutOfStock: true }]),
    ).toBe(true);
  });

  it('is in stock while any single price remains', () => {
    expect(
      deriveProductOutOfStock([
        { isOutOfStock: true },
        { isOutOfStock: false },
      ]),
    ).toBe(false);
    expect(deriveProductOutOfStock([{ isOutOfStock: false }])).toBe(false);
  });
});

describe('setProductOutOfStock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductUpdateMany.mockResolvedValue({ count: 1 });
    mockPricesUpdateMany.mockResolvedValue({ count: 1 });
    mockTransaction.mockImplementation((ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
  });

  it('stamps the product and cascades to its prices', async () => {
    await setProductOutOfStock(PRODUCT, true);

    expect(mockProductUpdateMany).toHaveBeenCalledWith({
      where: { id: PRODUCT, isOutOfStock: false },
      data: { isOutOfStock: true, outOfStockAt: expect.any(Date) },
    });
    expect(mockPricesUpdateMany).toHaveBeenCalledWith({
      where: { productId: PRODUCT, isOutOfStock: false },
      data: { isOutOfStock: true, outOfStockAt: expect.any(Date) },
    });
  });

  it('clears the stamp on both when the product comes back in stock', async () => {
    await setProductOutOfStock(PRODUCT, false);

    expect(mockProductUpdateMany).toHaveBeenCalledWith({
      where: { id: PRODUCT, isOutOfStock: true },
      data: { isOutOfStock: false, outOfStockAt: null },
    });
    expect(mockPricesUpdateMany).toHaveBeenCalledWith({
      where: { productId: PRODUCT, isOutOfStock: true },
      data: { isOutOfStock: false, outOfStockAt: null },
    });
  });

  it('guards the write on the previous state so a repeat call cannot re-stamp', async () => {
    await setProductOutOfStock(PRODUCT, true);

    // The `isOutOfStock: false` in the where clause is what makes this safe to
    // run twice: the second call matches no rows and outOfStockAt stands.
    const [{ where }] = mockProductUpdateMany.mock.calls[0];
    expect(where.isOutOfStock).toBe(false);
  });

  it('writes the product and its prices atomically', async () => {
    await setProductOutOfStock(PRODUCT, true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('syncProductOutOfStockFromPrices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('leaves a product with no connected prices alone', async () => {
    mockPricesFindMany.mockResolvedValue([]);

    await syncProductOutOfStockFromPrices(PRODUCT);

    expect(mockProductUpdateMany).not.toHaveBeenCalled();
  });

  it('marks the product out of stock once its last price is', async () => {
    mockPricesFindMany.mockResolvedValue([
      { isOutOfStock: true },
      { isOutOfStock: true },
    ]);

    await syncProductOutOfStockFromPrices(PRODUCT);

    expect(mockProductUpdateMany).toHaveBeenCalledWith({
      where: { id: PRODUCT, isOutOfStock: false },
      data: { isOutOfStock: true, outOfStockAt: expect.any(Date) },
    });
  });

  it('brings the product back as soon as one price is in stock', async () => {
    mockPricesFindMany.mockResolvedValue([
      { isOutOfStock: true },
      { isOutOfStock: false },
    ]);

    await syncProductOutOfStockFromPrices(PRODUCT);

    expect(mockProductUpdateMany).toHaveBeenCalledWith({
      where: { id: PRODUCT, isOutOfStock: true },
      data: { isOutOfStock: false, outOfStockAt: null },
    });
  });
});

describe('syncAllProductsOutOfStock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductUpdateMany.mockResolvedValue({ count: 1 });
    mockTransaction.mockImplementation((ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
  });

  it('writes nothing when every product already matches its prices', async () => {
    mockProductFindMany.mockResolvedValue([
      { id: 'a', isOutOfStock: true, prices: [{ isOutOfStock: true }] },
      { id: 'b', isOutOfStock: false, prices: [{ isOutOfStock: false }] },
      // No prices to derive from — an admin's manual flag is left standing.
      { id: 'c', isOutOfStock: true, prices: [] },
    ]);

    const result = await syncAllProductsOutOfStock();

    expect(result).toEqual({ markedOutOfStock: 0, markedInStock: 0 });
    expect(mockProductUpdateMany).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('corrects drifted products in both directions and reports the counts', async () => {
    mockProductFindMany.mockResolvedValue([
      {
        id: 'stale-in-stock',
        isOutOfStock: false,
        prices: [{ isOutOfStock: true }],
      },
      {
        id: 'stale-out-of-stock',
        isOutOfStock: true,
        prices: [{ isOutOfStock: false }, { isOutOfStock: true }],
      },
      { id: 'correct', isOutOfStock: false, prices: [{ isOutOfStock: false }] },
    ]);

    const result = await syncAllProductsOutOfStock();

    expect(result).toEqual({ markedOutOfStock: 1, markedInStock: 1 });
    expect(mockProductUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['stale-in-stock'] }, isOutOfStock: false },
      data: { isOutOfStock: true, outOfStockAt: expect.any(Date) },
    });
    expect(mockProductUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['stale-out-of-stock'] }, isOutOfStock: true },
      data: { isOutOfStock: false, outOfStockAt: null },
    });
  });
});

describe('outOfStockCascade', () => {
  it('cascades nothing when the edit carries no stock field', () => {
    expect(outOfStockCascade(undefined, false)).toBeNull();
  });

  // The product form posts isOutOfStock on every save, so "the field is here"
  // cannot mean "the admin changed it" — otherwise editing a photo would
  // cascade in-stock over every hand-marked sold-out price.
  it('cascades nothing when the posted flag matches the stored one', () => {
    expect(outOfStockCascade(false, false)).toBeNull();
    expect(outOfStockCascade(true, true)).toBeNull();
  });

  it('cascades the new value when the flag actually changed', () => {
    expect(outOfStockCascade(true, false)).toBe(true);
    expect(outOfStockCascade(false, true)).toBe(false);
  });
});

describe('initialOutOfStockFields', () => {
  it('leaves a new in-stock product without a timestamp', () => {
    expect(initialOutOfStockFields(false)).toEqual({
      isOutOfStock: false,
      outOfStockAt: null,
    });
  });

  // A product created sold-out still has to be visible to the retention job,
  // which only considers rows carrying a real outOfStockAt.
  it('stamps a new product created out of stock', () => {
    const fields = initialOutOfStockFields(true);

    expect(fields.isOutOfStock).toBe(true);
    expect(fields.outOfStockAt).toBeInstanceOf(Date);
  });
});

describe('retireLongOutOfStockProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductUpdateMany.mockResolvedValue({ count: 1 });
    mockPricesUpdateMany.mockResolvedValue({ count: 0 });
    mockCartItemDeleteMany.mockResolvedValue({ count: 0 });
    mockBannerFindMany.mockResolvedValue([]);
    mockSyncBrandProductCount.mockResolvedValue(undefined);
    mockTransaction.mockImplementation((ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
  });

  it('only considers products with a real out-of-stock timestamp', async () => {
    mockProductFindMany.mockResolvedValue([]);

    await retireLongOutOfStockProducts(365);

    const [{ where }] = mockProductFindMany.mock.calls[0];
    expect(where.deletedAt).toBeNull();
    expect(where.isOutOfStock).toBe(true);
    // Rows predating the column have no timestamp; "unknown age" must never be
    // treated as "old enough to delete".
    expect(where.outOfStockAt.not).toBeNull();
    expect(where.outOfStockAt.lt).toBeInstanceOf(Date);
  });

  it('writes nothing when no product is old enough', async () => {
    mockProductFindMany.mockResolvedValue([]);

    const result = await retireLongOutOfStockProducts(365);

    expect(result).toEqual({ retired: 0, skippedWithActiveBanner: 0 });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('soft-deletes expired products and clears their cart items', async () => {
    mockProductFindMany.mockResolvedValue([
      { id: 'old-1', brandId: 'brand-1' },
      { id: 'old-2', brandId: null },
    ]);

    const result = await retireLongOutOfStockProducts(365);

    expect(result).toEqual({ retired: 2, skippedWithActiveBanner: 0 });
    expect(mockProductUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['old-1', 'old-2'] }, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mockCartItemDeleteMany).toHaveBeenCalledWith({
      where: { productId: { in: ['old-1', 'old-2'] } },
    });
    // Only the product that had a brand triggers a recount.
    expect(mockSyncBrandProductCount).toHaveBeenCalledTimes(1);
    expect(mockSyncBrandProductCount).toHaveBeenCalledWith('brand-1');
  });

  // A retired product keeps its row, so a price left pointing at it is owned by
  // something no admin screen lists: the price stops showing as unassigned and
  // the reassignment guard still refuses to hand it to anyone else.
  it('releases the prices of every retired product', async () => {
    mockProductFindMany.mockResolvedValue([
      { id: 'old-1', brandId: null },
      { id: 'old-2', brandId: null },
    ]);

    await retireLongOutOfStockProducts(365);

    expect(mockPricesUpdateMany).toHaveBeenCalledWith({
      where: { productId: { in: ['old-1', 'old-2'] } },
      data: { productId: null },
    });
  });

  it('spares a product an active promo banner still points at', async () => {
    mockProductFindMany.mockResolvedValue([
      { id: 'old-1', brandId: null },
      { id: 'promoted', brandId: null },
    ]);
    mockBannerFindMany.mockResolvedValue([{ redirectProductId: 'promoted' }]);

    const result = await retireLongOutOfStockProducts(365);

    expect(result).toEqual({ retired: 1, skippedWithActiveBanner: 1 });
    expect(mockProductUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['old-1'] }, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('writes nothing when every expired product is banner-blocked', async () => {
    mockProductFindMany.mockResolvedValue([{ id: 'promoted', brandId: null }]);
    mockBannerFindMany.mockResolvedValue([{ redirectProductId: 'promoted' }]);

    const result = await retireLongOutOfStockProducts(365);

    expect(result).toEqual({ retired: 0, skippedWithActiveBanner: 1 });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
