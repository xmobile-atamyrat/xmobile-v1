import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLog } = vi.hoisted(() => ({ mockLog: vi.fn() }));

vi.mock('@/lib/adminActivity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/adminActivity')>()),
  logAdminActivity: mockLog,
}));

vi.mock('@/lib/dbClient', () => ({
  default: {
    product: { findMany: vi.fn().mockResolvedValue([]) },
    category: { findMany: vi.fn().mockResolvedValue([]) },
    dollarRate: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import {
  buildPriceUpdateMeta,
  PRICE_ROW_LOG_LIMIT,
  recordPricesUpdated,
} from '@/lib/priceActivity';
import type { Prices } from '@prisma/client';

const price = {
  id: 'pr1',
  name: '128gb Black',
  price: '340',
  priceInTmt: '6664',
  displayPriceTmt: '6660',
  productId: null,
  categoryId: null,
  dollarRateId: 1,
  outOfStockAt: null,
} as Prices;

const noNames = {
  product: new Map<string, string>(),
  category: new Map<string, string>(),
  rate: new Map<string, string>(),
};

describe('buildPriceUpdateMeta', () => {
  it('returns null when nothing changed', () => {
    expect(buildPriceUpdateMeta(price, { ...price }, noNames)).toBeNull();
  });

  it('records a price change with the name', () => {
    expect(
      buildPriceUpdateMeta(price, { ...price, price: '355' }, noNames),
    ).toEqual({
      name: '128gb Black',
      changes: { price: { from: '340', to: '355' } },
    });
  });

  it('records a rename, the shown TMT price and a stock flip', () => {
    expect(
      buildPriceUpdateMeta(
        price,
        {
          ...price,
          name: '128gb Blue',
          displayPriceTmt: '6700',
          outOfStockAt: new Date('2026-10-01'),
        },
        noNames,
      ),
    ).toEqual({
      name: '128gb Blue',
      changes: {
        name: { from: '128gb Black', to: '128gb Blue' },
        displayPriceTmt: { from: '6660', to: '6700' },
        outOfStock: { from: false, to: true },
      },
    });
  });

  it('resolves linked product, category and rate to names', () => {
    expect(
      buildPriceUpdateMeta(
        price,
        { ...price, productId: 'p9', categoryId: 'c9', dollarRateId: 2 },
        {
          product: new Map([['p9', 'iPhone 15']]),
          category: new Map([['c9', 'Phones']]),
          rate: new Map([
            ['1', 'Manat'],
            ['2', 'Wholesale'],
          ]),
        },
      ),
    ).toEqual({
      name: '128gb Black',
      changes: {
        product: { from: null, to: 'iPhone 15' },
        category: { from: null, to: 'Phones' },
        rate: { from: 'Manat', to: 'Wholesale' },
      },
    });
  });
});

describe('recordPricesUpdated', () => {
  beforeEach(() => mockLog.mockClear());

  const pair = (i: number, changed: boolean) => ({
    before: { ...price, id: `pr${i}` },
    after: { ...price, id: `pr${i}`, price: changed ? '999' : price.price },
  });

  it('logs nothing when no price changed', async () => {
    await recordPricesUpdated('u1', [pair(1, false), pair(2, false)]);
    expect(mockLog).not.toHaveBeenCalled();
  });

  it('logs one row per changed price up to the limit', async () => {
    await recordPricesUpdated('u1', [
      pair(1, true),
      pair(2, false),
      pair(3, true),
    ]);
    expect(mockLog).toHaveBeenCalledTimes(2);
    expect(mockLog.mock.calls[0][0]).toMatchObject({
      userId: 'u1',
      entity: 'PRICE',
      action: 'UPDATE',
      targetId: 'pr1',
    });
  });

  it('collapses a large save into a single summary row', async () => {
    const pairs = Array.from({ length: PRICE_ROW_LOG_LIMIT + 1 }, (_, i) =>
      pair(i, true),
    );
    await recordPricesUpdated('u1', pairs);
    expect(mockLog).toHaveBeenCalledTimes(1);
    expect(mockLog.mock.calls[0][0]).toMatchObject({
      entity: 'PRICE',
      action: 'UPDATE',
      targetId: null,
      meta: { count: PRICE_ROW_LOG_LIMIT + 1, fields: ['price'] },
    });
  });
});
