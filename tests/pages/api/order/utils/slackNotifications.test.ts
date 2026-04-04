import { UserOrderStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSlack, mockSend } = vi.hoisted(() => ({
  mockGetSlack: vi.fn(),
  mockSend: vi.fn(),
}));

vi.mock('@/lib/slack', () => ({
  getSlack: mockGetSlack,
}));

import {
  notifyOrderCancelledByUser,
  notifyOrderCreated,
  notifyOrderStatusUpdated,
} from '@/pages/api/order/utils/slackNotifications';

const baseOrder = {
  id: 'order-id-1',
  orderNumber: 'ORD-001',
  userName: 'Jane',
  deliveryPhone: '+123',
  deliveryAddress: 'Addr',
  totalPrice: '99.50',
  status: UserOrderStatus.PENDING,
  cancellationReason: null,
  adminNotes: null,
} as any;

describe('slack order notifications', () => {
  beforeEach(() => {
    mockGetSlack.mockReset();
    mockSend.mockReset();
    mockSend.mockResolvedValue({ success: true });
  });

  it('notifyOrderCreated no-ops when Slack client is missing', async () => {
    mockGetSlack.mockReturnValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await notifyOrderCreated(baseOrder);
    expect(mockSend).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('notifyOrderCreated sends a localized message with order link', async () => {
    mockGetSlack.mockReturnValue({ send: mockSend });
    await notifyOrderCreated(baseOrder);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const [message] = mockSend.mock.calls[0];
    expect(message).toContain('ORD-001');
    expect(message).toContain('Jane');
    expect(message).toContain('99.50');
    expect(message).toContain('/orders/admin/order-id-1');
  });

  it('notifyOrderCancelledByUser includes optional reason', async () => {
    mockGetSlack.mockReturnValue({ send: mockSend });
    await notifyOrderCancelledByUser({
      ...baseOrder,
      status: UserOrderStatus.USER_CANCELLED,
      cancellationReason: 'changed mind',
    });

    expect(mockSend.mock.calls[0][0]).toContain('changed mind');
  });

  it('notifyOrderStatusUpdated includes admin notes and cancellation reason', async () => {
    mockGetSlack.mockReturnValue({ send: mockSend });
    await notifyOrderStatusUpdated(
      {
        ...baseOrder,
        status: UserOrderStatus.ADMIN_CANCELLED,
        cancellationReason: 'stock',
        adminNotes: 'note',
      },
      UserOrderStatus.PENDING,
    );

    const msg = mockSend.mock.calls[0][0] as string;
    expect(msg).toContain('stock');
    expect(msg).toContain('note');
  });
});
