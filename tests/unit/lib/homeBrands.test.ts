import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getHomeBrands } from '@/lib/homeBrands';

const { mockFindMany, mockBuildProductWhere } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockBuildProductWhere: vi.fn(),
}));

vi.mock('@/lib/dbClient', () => ({
  default: { brand: { findMany: mockFindMany } },
}));

vi.mock('@/pages/api/product/productWhere', () => ({
  buildProductWhere: mockBuildProductWhere,
}));

const brand = (id: string, products: number) => ({
  id,
  name: id.toUpperCase(),
  _count: { products },
});

describe('getHomeBrands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts and keeps only brands with products the in-stock listing would show', async () => {
    const inStockWhere = { deletedAt: null as null, stock: { gt: 0 } };
    mockBuildProductWhere.mockResolvedValue(inStockWhere);
    mockFindMany.mockResolvedValue([brand('b1', 12)]);

    await expect(getHomeBrands()).resolves.toEqual([{ id: 'b1', name: 'B1' }]);

    expect(mockBuildProductWhere).toHaveBeenCalledWith({ inStock: '1' });
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { products: { some: inStockWhere } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        _count: { select: { products: { where: inStockWhere } } },
      },
    });
  });

  it('drops brands under 10 products and keeps the admin order', async () => {
    mockBuildProductWhere.mockResolvedValue({});
    mockFindMany.mockResolvedValue([
      brand('b3', 10),
      brand('b1', 9),
      brand('b2', 40),
    ]);

    await expect(getHomeBrands()).resolves.toEqual([
      { id: 'b3', name: 'B3' },
      { id: 'b2', name: 'B2' },
    ]);
  });
});
