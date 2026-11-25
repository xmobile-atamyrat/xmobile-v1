import handler from '@/pages/api/product/filters.page';
import type { NextApiRequest, NextApiResponse } from 'next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const count = vi.fn();

vi.mock('@/lib/dbClient', () => ({
  default: {
    product: {
      count: (...args: unknown[]) => count(...args),
      groupBy: async (): Promise<never[]> => [],
      findMany: async (): Promise<never[]> => [],
    },
  },
}));
vi.mock('@/lib/saleProducts', () => ({
  getOnSaleProducts: async (): Promise<never[]> => [],
}));
vi.mock('@/pages/api/utils/addCors', () => ({ default: vi.fn() }));
vi.mock('@/pages/api/utils/staffAuth', () => ({
  hasStaffBearer: async () => false,
}));
// A stand-in that shows which scope each count ran with.
vi.mock('@/pages/api/product/productWhere', () => ({
  buildProductWhere: async (query: { sale?: string }) => ({
    onSale: query.sale === '1',
  }),
}));

async function filtersFor(query: Record<string, string>) {
  const json = vi.fn();
  const res = { status: vi.fn(() => ({ json })) };
  await handler(
    { method: 'GET', query } as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  );
  return json.mock.calls[0][0].data;
}

describe('GET /api/product/filters sale relaxation', () => {
  beforeEach(() => {
    count.mockReset();
    // Nothing on sale matches; without the sale filter, six products do.
    count.mockImplementation(async ({ where }) => (where.onSale ? 0 : 6));
  });

  it('says what dropping the sale filter would show', async () => {
    const data = await filtersFor({ sale: '1' });

    expect(data.total).toBe(0);
    expect(data.relaxations).toEqual({ sale: 6 });
  });

  it('says nothing about it when the filter is off', async () => {
    const data = await filtersFor({});

    expect(data.relaxations).toEqual({});
  });
});
