import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildPriceStalenessContent,
  priceStalenessJob,
  runPriceStaleness,
} from '../../../scripts/batch-runner/jobs/price-staleness';

const { countStale, userFindMany, notifCreate, sendFcm } = vi.hoisted(() => ({
  countStale: vi.fn(),
  userFindMany: vi.fn(),
  notifCreate: vi.fn(),
  sendFcm: vi.fn(),
}));

vi.mock('../../../src/lib/dbClient', () => ({
  default: {
    user: { findMany: userFindMany },
    inAppNotification: { create: notifCreate },
  },
}));
vi.mock('../../../src/lib/priceStalenessQueries', () => ({
  countStaleProducts: countStale,
}));
vi.mock('../../../src/lib/fcm/fcmService', () => ({
  sendFCMWithCallbackFallback: sendFcm,
}));
vi.mock('../../../src/ws-server/lib/utils', () => ({
  sendNotificationToWebSocketServer: vi.fn(),
}));

describe('price-staleness job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
    notifCreate.mockImplementation(async ({ data }) => ({
      id: `n-${data.userId}`,
      ...data,
    }));
    sendFcm.mockResolvedValue(true);
  });

  it('is scheduled daily 09:00 Asia/Ashgabat', () => {
    expect(priceStalenessJob.id).toBe('price-staleness');
    expect(priceStalenessJob.schedule).toEqual({
      type: 'cron',
      expr: '0 9 * * *',
      timezone: 'Asia/Ashgabat',
    });
  });

  it('skips when nothing is stale', async () => {
    countStale.mockResolvedValue({ orange: 0, red: 0 });
    const s = await runPriceStaleness();
    expect(userFindMany).not.toHaveBeenCalled();
    expect(notifCreate).not.toHaveBeenCalled();
    expect(sendFcm).not.toHaveBeenCalled();
    expect(s.recipients).toBe(0);
  });

  it('creates and sends one notification per admin', async () => {
    countStale.mockResolvedValue({ orange: 5, red: 2 });
    const s = await runPriceStaleness();
    expect(userFindMany).toHaveBeenCalledWith({
      where: { grade: { in: ['ADMIN', 'SUPERUSER'] }, deletedAt: null },
      select: { id: true },
    });
    expect(notifCreate).toHaveBeenCalledTimes(2);
    expect(notifCreate.mock.calls[0][0].data).toMatchObject({
      userId: 'a1',
      type: 'PRICE_STALENESS',
      isRead: false,
      content: buildPriceStalenessContent(5, 2),
    });
    expect(notifCreate.mock.calls[0][0].data).not.toHaveProperty('orderId');
    expect(sendFcm).toHaveBeenCalledTimes(2);
    expect(sendFcm.mock.calls[1][0]).toBe('a2');
    expect(s).toMatchObject({ sent: 2, failed: 0, recipients: 2 });
  });

  it('omits a part whose count is zero', () => {
    expect(buildPriceStalenessContent(0, 4)).toBe(
      'Товары без обновления цены: больше 3 месяцев — 4',
    );
    expect(buildPriceStalenessContent(3, 0)).toBe(
      'Товары без обновления цены: 1–3 месяца — 3',
    );
    expect(buildPriceStalenessContent(3, 4)).toBe(
      'Товары без обновления цены: 1–3 месяца — 3, больше 3 месяцев — 4',
    );
  });

  it("one user's failure does not block the others", async () => {
    countStale.mockResolvedValue({ orange: 1, red: 0 });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    sendFcm.mockRejectedValueOnce(new Error('boom'));
    const s = await runPriceStaleness();
    expect(sendFcm).toHaveBeenCalledTimes(2);
    expect(s).toMatchObject({ sent: 1, failed: 1 });
  });
});
