import { describe, expect, it, vi } from 'vitest';

import {
  cancelUserOrder,
  getUserOrderDetail,
  getUserOrdersList,
} from '@/pages/orders/lib/apiUtils';

describe('getUserOrdersList', () => {
  it('appends end-of-day when dateTo is date-only', async () => {
    const fetchWithCreds = vi.fn().mockResolvedValue({
      success: true,
      data: {
        orders: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
    });

    await getUserOrdersList({
      accessToken: 't',
      dateTo: '2024-12-31',
      fetchWithCreds,
    });

    expect(fetchWithCreds).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringContaining('dateTo=2024-12-31T23%3A59%3A59.999Z'),
      }),
    );
  });

  it('passes through full ISO dateTo unchanged', async () => {
    const fetchWithCreds = vi.fn().mockResolvedValue({
      success: true,
      data: {
        orders: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
    });

    await getUserOrdersList({
      accessToken: 't',
      dateTo: '2024-12-31T12:00:00.000Z',
      fetchWithCreds,
    });

    expect(fetchWithCreds).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringContaining(
          encodeURIComponent('2024-12-31T12:00:00.000Z'),
        ),
      }),
    );
  });

  it('returns fetchOrdersError on thrown network errors', async () => {
    const fetchWithCreds = vi.fn().mockRejectedValue(new Error('network'));
    const out = await getUserOrdersList({
      accessToken: 't',
      fetchWithCreds,
    });
    expect(out.success).toBe(false);
    expect(out.message).toBe('fetchOrdersError');
  });
});

describe('getUserOrderDetail', () => {
  it('proxies fetchWithCreds result', async () => {
    const fetchWithCreds = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'o1' },
    });
    const out = await getUserOrderDetail({
      accessToken: 't',
      orderId: 'o1',
      fetchWithCreds,
    });
    expect(out.success).toBe(true);
    expect(out.data).toEqual({ id: 'o1' });
    expect(fetchWithCreds).toHaveBeenCalledWith({
      accessToken: 't',
      path: '/api/order/o1',
      method: 'GET',
    });
  });
});

describe('cancelUserOrder', () => {
  it('PUTs to cancel endpoint with optional reason', async () => {
    const fetchWithCreds = vi.fn().mockResolvedValue({ success: true });
    await cancelUserOrder({
      accessToken: 't',
      orderId: 'o9',
      cancellationReason: 'x',
      fetchWithCreds,
    });
    expect(fetchWithCreds).toHaveBeenCalledWith({
      accessToken: 't',
      path: '/api/order/o9?action=cancel',
      method: 'PUT',
      body: { cancellationReason: 'x' },
    });
  });
});
