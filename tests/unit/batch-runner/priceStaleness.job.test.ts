import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildPriceStalenessContent,
  buildPriceStalenessTitle,
  PRICE_STALENESS_TITLES,
  priceStalenessJob,
  ruPlural,
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
      title: buildPriceStalenessTitle(7),
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

  describe('title', () => {
    const DAY = 24 * 60 * 60 * 1000;
    // 2026-11-25 10:00 in Ashgabat (UTC+5).
    const base = new Date('2026-11-25T05:00:00Z');

    it('picks the Russian plural form', () => {
      const f = (n: number) => ruPlural(n, 'товар', 'товара', 'товаров');
      expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111].map(f)).toEqual([
        'товар',
        'товара',
        'товара',
        'товаров',
        'товаров',
        'товаров',
        'товаров',
        'товар',
        'товара',
        'товаров',
        'товар',
        'товаров',
      ]);
    });

    it('renders every line with the count and no gaps', () => {
      PRICE_STALENESS_TITLES.forEach((_, i) => {
        const day = new Date(base.getTime() + i * DAY);
        [1, 3, 14, 21].forEach((n) => {
          const title = buildPriceStalenessTitle(n, day);
          expect(title).toContain(String(n));
          expect(title).not.toMatch(/undefined|\$\{/);
        });
      });
    });

    it('agrees with the count', () => {
      // Find the "скучает/скучают" line by trying each day in the cycle.
      const titles = PRICE_STALENESS_TITLES.map((_, i) =>
        buildPriceStalenessTitle(1, new Date(base.getTime() + i * DAY)),
      );
      expect(titles).toContain('1 товар скучает по тебе 🥺');
      const many = PRICE_STALENESS_TITLES.map((_, i) =>
        buildPriceStalenessTitle(14, new Date(base.getTime() + i * DAY)),
      );
      expect(many).toContain('14 товаров скучают по тебе 🥺');
      expect(many).toContain('Цены у 14 товаров покрылись пылью 🕸');
    });

    it('shows every line once per cycle and never the same two days running', () => {
      const n = PRICE_STALENESS_TITLES.length;
      const titles = Array.from({ length: n * 2 }, (_, i) =>
        buildPriceStalenessTitle(5, new Date(base.getTime() + i * DAY)),
      );
      expect(new Set(titles.slice(0, n)).size).toBe(n);
      titles.slice(1).forEach((title, i) => {
        expect(title).not.toBe(titles[i]);
      });
    });

    it('keeps the same line all day in Ashgabat', () => {
      // 00:30 and 23:30 Ashgabat time on the same date.
      expect(
        buildPriceStalenessTitle(5, new Date('2026-11-24T19:30:00Z')),
      ).toBe(buildPriceStalenessTitle(5, new Date('2026-11-25T18:30:00Z')));
    });
  });
});
