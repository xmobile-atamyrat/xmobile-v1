import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUpdateMany } = vi.hoisted(() => ({
  mockUpdateMany: vi.fn(),
}));

vi.mock('@/lib/dbClient', () => ({
  default: {
    inAppNotification: { updateMany: mockUpdateMany },
  },
}));

import { recordNotificationDelivery } from '@/lib/fcm/fcmService';

describe('recordNotificationDelivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes SENT on the first try when the DB is healthy', async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });
    await recordNotificationDelivery('n1', true);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: expect.objectContaining({ deliveryStatus: 'SENT' }),
    });
  });

  it('retries past transient failures instead of leaving a delivered row stuck PENDING', async () => {
    mockUpdateMany
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce({ count: 1 });
    await recordNotificationDelivery('n2', true);
    expect(mockUpdateMany).toHaveBeenCalledTimes(2);
  });

  it('gives up after 3 attempts without throwing', async () => {
    mockUpdateMany.mockRejectedValue(new Error('db down'));
    await expect(
      recordNotificationDelivery('n3', true),
    ).resolves.toBeUndefined();
    expect(mockUpdateMany).toHaveBeenCalledTimes(3);
  });

  it('does not downgrade an already-SENT row when a racing attempt reports failure', async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });
    await recordNotificationDelivery('n4', false);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 'n4', deliveryStatus: { not: 'SENT' } },
      data: expect.objectContaining({ deliveryStatus: 'PENDING' }),
    });
  });
});
