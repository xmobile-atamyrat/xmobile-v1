import type { Prices } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/api/prices/index.page', () => ({
  getPrice: vi.fn(),
}));
vi.mock('@/pages/api/colors/index.page', () => ({
  getColor: vi.fn().mockResolvedValue(null),
}));

import { getPrice } from '@/pages/api/prices/index.page';
import { buildOrderItemsData } from '@/pages/api/order/services/orderService';

const cartItem = (over: Record<string, unknown> = {}) => ({
  quantity: 1,
  productId: 'prod-1',
  product: { name: 'iPhone 15', price: '[price-1]' },
  ...over,
});

describe('buildOrderItemsData', () => {
  beforeEach(() => {
    vi.mocked(getPrice).mockReset();
  });

  it('snapshots the rounded display price', async () => {
    vi.mocked(getPrice).mockResolvedValue({
      priceInTmt: '1283',
      displayPriceTmt: '1290',
    } as Prices);

    const [item] = await buildOrderItemsData([cartItem()]);
    expect(item.productPrice).toBe('1290');
  });

  it('falls back to priceInTmt when the display price is not computed yet', async () => {
    vi.mocked(getPrice).mockResolvedValue({
      priceInTmt: '1283',
      displayPriceTmt: null,
    } as Prices);

    const [item] = await buildOrderItemsData([cartItem()]);
    expect(item.productPrice).toBe('1283');
  });

  it('prefers the selected variant price over the product price', async () => {
    vi.mocked(getPrice).mockResolvedValue({
      priceInTmt: '2001',
      displayPriceTmt: '2010',
    } as Prices);

    const [item] = await buildOrderItemsData([
      cartItem({ selectedVariant: '256gb [price-2]' }),
    ]);

    expect(getPrice).toHaveBeenCalledWith('price-2');
    expect(item.productPrice).toBe('2010');
  });

  it('records 0 when the price reference cannot be resolved', async () => {
    vi.mocked(getPrice).mockResolvedValue(null);

    const [item] = await buildOrderItemsData([cartItem()]);
    expect(item.productPrice).toBe('0');
  });
});
