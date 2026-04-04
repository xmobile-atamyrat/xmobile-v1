import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCount, mockUpdate } = vi.hoisted(() => ({
  mockCount: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/lib/dbClient', () => ({
  default: {
    product: { count: mockCount },
    brand: { update: mockUpdate },
  },
}));

import { syncBrandProductCount } from '@/lib/brandProductCount';

describe('syncBrandProductCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCount.mockResolvedValue(7);
    mockUpdate.mockResolvedValue({});
  });

  it('no-ops when brandId is missing', async () => {
    await syncBrandProductCount(undefined);
    await syncBrandProductCount(null);
    await syncBrandProductCount('');
    expect(mockCount).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('counts active products and updates brand.productCount', async () => {
    await syncBrandProductCount('brand-1');

    expect(mockCount).toHaveBeenCalledWith({
      where: { brandId: 'brand-1', deletedAt: null },
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'brand-1' },
      data: { productCount: 7 },
    });
  });
});
