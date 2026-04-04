import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTransaction } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}));

vi.mock('@/lib/dbClient', () => ({
  default: {
    $transaction: mockTransaction,
  },
}));

import { generateOrderNumber } from '@/pages/api/order/utils/orderUtils';

describe('generateOrderNumber', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-11-20T12:00:00.000Z'));
    mockTransaction.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes counter at 001 when row is missing', async () => {
    mockTransaction.mockImplementation(
      async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          orderNumberCounter: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 1, counter: 1 }),
            update: vi.fn(),
          },
        };
        return fn(tx);
      },
    );

    expect(await generateOrderNumber()).toBe('ORD-20251120-001');
  });

  it('increments existing counter and pads to three digits', async () => {
    mockTransaction.mockImplementation(
      async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          orderNumberCounter: {
            findUnique: vi.fn().mockResolvedValue({ id: 1, counter: 41 }),
            create: vi.fn(),
            update: vi.fn().mockResolvedValue({ id: 1, counter: 42 }),
          },
        };
        return fn(tx);
      },
    );

    expect(await generateOrderNumber()).toBe('ORD-20251120-042');
  });
});
