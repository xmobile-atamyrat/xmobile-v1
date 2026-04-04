import { OrderPriceColor } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { HistoryPrice } from '@/pages/procurement/lib/types';
import {
  assignColorToPrices,
  dayMonthYearFromDate,
  IDS_SHEET_NAME,
  ORDER_SHEET_NAME,
  priceHash,
} from '@/pages/procurement/lib/utils';

describe('sheet name constants', () => {
  it('matches procurement Excel layout', () => {
    expect(ORDER_SHEET_NAME).toBe('Order');
    expect(IDS_SHEET_NAME).toBe('IDs');
  });
});

describe('priceHash', () => {
  it('JSON-encodes the composite key', () => {
    expect(
      priceHash({ orderId: 'o1', productId: 'p1', supplierId: 's1' }),
    ).toBe(
      JSON.stringify({ orderId: 'o1', productId: 'p1', supplierId: 's1' }),
    );
  });
});

describe('dayMonthYearFromDate', () => {
  it('formats dd-mm-yyyy with zero padding', () => {
    expect(dayMonthYearFromDate(new Date(2024, 0, 5))).toBe('05-01-2024');
  });
});

describe('assignColorToPrices', () => {
  it('marks cheapest green and most expensive orange across suppliers', () => {
    const orderId = 'ord';
    const p1 = 'prod-1';
    const sLow = 'sup-a';
    const sHigh = 'sup-b';
    const kLow = priceHash({ orderId, productId: p1, supplierId: sLow });
    const kHigh = priceHash({ orderId, productId: p1, supplierId: sHigh });

    const prices: HistoryPrice = {
      [kLow]: { value: 5 },
      [kHigh]: { value: 15 },
    };

    const out = assignColorToPrices({
      orderId,
      prices,
      productIds: [p1],
      supplierIds: [sLow, sHigh],
    });

    expect(out[kLow].color).toBe(OrderPriceColor.green);
    expect(out[kHigh].color).toBe(OrderPriceColor.orange);
  });
});
