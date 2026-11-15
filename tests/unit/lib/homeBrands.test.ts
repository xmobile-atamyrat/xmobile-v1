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

describe('getHomeBrands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([{ id: 'b1', name: 'Samsung' }]);
  });

  it('keeps only brands with a product the in-stock listing would show', async () => {
    const inStockWhere = { deletedAt: null as null, stock: { gt: 0 } };
    mockBuildProductWhere.mockResolvedValue(inStockWhere);

    await expect(getHomeBrands()).resolves.toEqual([
      { id: 'b1', name: 'Samsung' },
    ]);

    expect(mockBuildProductWhere).toHaveBeenCalledWith({ inStock: '1' });
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { products: { some: inStockWhere } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    });
  });
});
