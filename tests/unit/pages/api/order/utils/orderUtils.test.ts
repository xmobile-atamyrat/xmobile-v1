import type { Prices } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/api/prices/index.page', () => ({
  getPrice: vi.fn(),
}));

import { getPrice } from '@/pages/api/prices/index.page';
import { calculateTotalPrice } from '@/pages/api/order/utils/orderUtils';

describe('calculateTotalPrice', () => {
  beforeEach(() => {
    vi.mocked(getPrice).mockReset();
  });

  it('returns 0.00 for an empty cart', async () => {
    expect(await calculateTotalPrice([])).toBe('0.00');
  });

  it('skips items without a price string', async () => {
    expect(
      await calculateTotalPrice([
        { product: { price: null }, quantity: 2 },
        { product: { price: '' }, quantity: 1 },
      ]),
    ).toBe('0.00');
    expect(getPrice).not.toHaveBeenCalled();
  });

  it('skips items when price string has no bracket id', async () => {
    expect(
      await calculateTotalPrice([
        { product: { price: 'no-bracket-here' }, quantity: 1 },
      ]),
    ).toBe('0.00');
    expect(getPrice).not.toHaveBeenCalled();
  });

  it('resolves [id], multiplies by quantity, and sums', async () => {
    vi.mocked(getPrice).mockResolvedValue({
      priceInTmt: '10.50',
    } as Prices);

    const total = await calculateTotalPrice([
      { product: { price: '[price-1]' }, quantity: 2 },
      { product: { price: '[price-2]' }, quantity: 1 },
    ]);

    expect(getPrice).toHaveBeenCalledWith('price-1');
    expect(getPrice).toHaveBeenCalledWith('price-2');
    expect(total).toBe('31.50');
  });

  it('treats missing DB price or NaN as 0 for that line', async () => {
    vi.mocked(getPrice).mockResolvedValueOnce(null);
    vi.mocked(getPrice).mockResolvedValueOnce({
      priceInTmt: 'not-a-number',
    } as Prices);

    expect(
      await calculateTotalPrice([
        { product: { price: '[a]' }, quantity: 1 },
        { product: { price: '[b]' }, quantity: 1 },
      ]),
    ).toBe('0.00');
  });

  it('ignores rows with null priceInTmt from getPrice', async () => {
    vi.mocked(getPrice).mockResolvedValue({
      priceInTmt: null,
    } as unknown as Prices);

    expect(
      await calculateTotalPrice([{ product: { price: '[x]' }, quantity: 3 }]),
    ).toBe('0.00');
  });
});
