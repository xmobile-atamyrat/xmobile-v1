import {
  getSupplierStats,
  supplierPriceIds,
  withoutSupplierPrices,
} from '@/pages/procurement/lib/supplierStats';
import { HistoryPrice } from '@/pages/procurement/lib/types';
import { priceHash } from '@/pages/procurement/lib/utils';
import { describe, expect, it } from 'vitest';

const orderId = 'o1';
const key = (productId: string, supplierId: string) =>
  priceHash({ orderId, productId, supplierId });

describe('getSupplierStats', () => {
  it('counts priced cells only for products with a quantity', () => {
    const prices: HistoryPrice = {
      [key('p1', 's1')]: { value: 10 },
      [key('p2', 's1')]: { value: 3.67 },
      // p3 has no quantity, so its price is not counted
      [key('p3', 's1')]: { value: 5 },
      // an emptied field is not a price
      [key('p1', 's2')]: { value: null as unknown as number },
      [key('p2', 's2')]: { value: Number.NaN },
    };
    const { bySupplier, calculated } = getSupplierStats({
      orderId,
      supplierIds: ['s1', 's2', 's3'],
      productIds: ['p1', 'p2', 'p3', 'p4'],
      quantities: { p1: 2, p2: 1, p3: 0, p4: null },
      prices,
    });
    expect(bySupplier.s1).toEqual({ priced: 2, total: 2, cheapest: 0 });
    expect(bySupplier.s2).toEqual({ priced: 0, total: 2, cheapest: 0 });
    expect(bySupplier.s3).toEqual({ priced: 0, total: 2, cheapest: 0 });
    expect(calculated).toBe(false);
  });

  it('counts green cells as cheapest once the order is calculated', () => {
    const prices: HistoryPrice = {
      [key('p1', 's1')]: { value: 10, color: 'green' },
      [key('p2', 's1')]: { value: 20, color: 'orange' },
      [key('p1', 's2')]: { value: 12, color: 'orange' },
      [key('p2', 's2')]: { value: 15, color: 'green' },
      // green but not being bought: flags the order calculated, not counted
      [key('p3', 's2')]: { value: 1, color: 'green' },
    };
    const { bySupplier, calculated } = getSupplierStats({
      orderId,
      supplierIds: ['s1', 's2'],
      productIds: ['p1', 'p2', 'p3'],
      quantities: { p1: 1, p2: 1 },
      prices,
    });
    expect(calculated).toBe(true);
    expect(bySupplier.s1.cheapest).toBe(1);
    expect(bySupplier.s2.cheapest).toBe(1);
    expect(bySupplier.s2.priced).toBe(2);
  });

  it('ignores cells that belong to another order', () => {
    const prices: HistoryPrice = {
      [priceHash({ orderId: 'other', productId: 'p1', supplierId: 's1' })]: {
        value: 1,
        color: 'green',
      },
    };
    const { bySupplier, calculated } = getSupplierStats({
      orderId,
      supplierIds: ['s1'],
      productIds: ['p1'],
      quantities: { p1: 1 },
      prices,
    });
    expect(bySupplier.s1).toEqual({ priced: 0, total: 1, cheapest: 0 });
    expect(calculated).toBe(false);
  });

  it('reports zero products when nothing has a quantity', () => {
    const { bySupplier } = getSupplierStats({
      orderId,
      supplierIds: ['s1'],
      productIds: [],
      quantities: {},
      prices: {},
    });
    expect(bySupplier.s1).toEqual({ priced: 0, total: 0, cheapest: 0 });
  });
});

describe('supplierPriceIds', () => {
  it('returns only the cells that exist for that supplier', () => {
    const prices: HistoryPrice = {
      [key('p1', 's1')]: { value: 1 },
      [key('p2', 's2')]: { value: 2 },
    };
    expect(
      supplierPriceIds({
        orderId,
        supplierId: 's1',
        productIds: ['p1', 'p2'],
        prices,
      }),
    ).toEqual([{ orderId, productId: 'p1', supplierId: 's1' }]);
  });
});

describe('withoutSupplierPrices', () => {
  it('returns a copy without the supplier cells and leaves the input alone', () => {
    const prices: HistoryPrice = {
      [key('p1', 's1')]: { value: 1 },
      [key('p2', 's1')]: { value: 2 },
      [key('p1', 's2')]: { value: 3 },
    };
    const snapshot = { ...prices };
    const next = withoutSupplierPrices({
      orderId,
      supplierId: 's1',
      productIds: ['p1', 'p2'],
      prices,
    });
    expect(next).not.toBe(prices);
    expect(next).toEqual({ [key('p1', 's2')]: { value: 3 } });
    expect(prices).toEqual(snapshot);
  });
});
