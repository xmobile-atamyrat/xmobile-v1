import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockProductFindMany, mockCategoryFindMany } = vi.hoisted(() => ({
  mockProductFindMany: vi.fn(),
  mockCategoryFindMany: vi.fn(),
}));

vi.mock('@/lib/dbClient', () => ({
  default: {
    product: { findMany: mockProductFindMany },
    category: { findMany: mockCategoryFindMany },
  },
}));

import {
  categoryRevalidationPaths,
  productIdsReferencingPrices,
  productRevalidationPaths,
} from '@/lib/revalidateTargets';

describe('productRevalidationPaths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the product pages plus its category listing pages', async () => {
    mockProductFindMany.mockResolvedValue([
      { slug: 'iphone-15', categories: { slug: 'phones' } },
    ]);

    const paths = await productRevalidationPaths(['p1']);

    expect(paths).toContain('/en/product/iphone-15');
    expect(paths).toContain('/tr/product/iphone-15');
    expect(paths).toContain('/en/product-category/phones');
    expect(paths).toHaveLength(10);
  });

  it('emits a shared category listing only once', async () => {
    mockProductFindMany.mockResolvedValue([
      { slug: 'a', categories: { slug: 'phones' } },
      { slug: 'b', categories: { slug: 'phones' } },
    ]);

    const paths = await productRevalidationPaths(['p1', 'p2']);

    expect(
      paths.filter((p) => p === '/en/product-category/phones'),
    ).toHaveLength(1);
    expect(paths).toHaveLength(15);
  });

  // `Product.categoryId` is non-nullable, so this is defensive rather than a
  // state the schema can currently reach — it keeps a missing relation from
  // queueing `/en/product-category/undefined`.
  it('omits listing pages when the category relation is absent', async () => {
    mockProductFindMany.mockResolvedValue([{ slug: 'a', categories: null }]);

    const paths = await productRevalidationPaths(['p1']);

    expect(paths).toEqual([
      '/en/product/a',
      '/ru/product/a',
      '/tk/product/a',
      '/ch/product/a',
      '/tr/product/a',
    ]);
  });

  it('includes soft-deleted products so their pages rebuild as 404s', async () => {
    mockProductFindMany.mockResolvedValue([]);

    await productRevalidationPaths(['p1']);

    const where = mockProductFindMany.mock.calls[0][0].where;
    expect(where).toEqual({ id: { in: ['p1'] } });
  });

  it('does not query for an empty id list', async () => {
    expect(await productRevalidationPaths([])).toEqual([]);
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });

  it('ignores null and duplicate ids', async () => {
    mockProductFindMany.mockResolvedValue([]);

    await productRevalidationPaths(['p1', 'p1', null, undefined]);

    expect(mockProductFindMany.mock.calls[0][0].where).toEqual({
      id: { in: ['p1'] },
    });
  });
});

describe('productIdsReferencingPrices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches the FK and both string-reference forms', async () => {
    mockProductFindMany.mockResolvedValue([{ id: 'prod-1' }]);

    await productIdsReferencingPrices(['price-1']);

    expect(mockProductFindMany.mock.calls[0][0].where).toEqual({
      OR: [
        { prices: { some: { id: { in: ['price-1'] } } } },
        { price: 'price-1' },
        { price: { contains: '[price-1]' } },
      ],
    });
  });

  it('returns the ids of products that reference the price', async () => {
    mockProductFindMany.mockResolvedValue([{ id: 'prod-1' }, { id: 'prod-2' }]);

    expect(await productIdsReferencingPrices(['price-1'])).toEqual([
      'prod-1',
      'prod-2',
    ]);
  });

  it('does not query for an empty id list', async () => {
    expect(await productIdsReferencingPrices([])).toEqual([]);
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });
});

describe('categoryRevalidationPaths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns both the browse and the listing page for each category', async () => {
    mockCategoryFindMany.mockResolvedValue([{ slug: 'phones' }]);

    const paths = await categoryRevalidationPaths(['c1']);

    expect(paths).toContain('/en/category/phones');
    expect(paths).toContain('/en/product-category/phones');
    expect(paths).toHaveLength(10);
  });

  it('does not query for an empty id list', async () => {
    expect(await categoryRevalidationPaths([null, undefined])).toEqual([]);
    expect(mockCategoryFindMany).not.toHaveBeenCalled();
  });
});
