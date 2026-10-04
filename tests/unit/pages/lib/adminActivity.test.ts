import { describe, expect, it } from 'vitest';

import {
  activitySentence,
  ActivityRow,
  formatActivityDay,
  formatActivityTime,
  heatmapGrid,
  relativeSeen,
} from '@/pages/lib/adminActivity';

// Echoes the key and values so a test can see exactly what the sentence asked
// the translator for, without depending on any locale's wording.
const t = (key: string, values?: Record<string, string | number>) =>
  values && Object.keys(values).length > 0
    ? `${key}(${Object.entries(values)
        .map(([k, v]) => `${k}=${v}`)
        .join(',')})`
    : key;

const row = (
  entity: ActivityRow['entity'],
  action: ActivityRow['action'],
  meta: ActivityRow['meta'],
): ActivityRow => ({
  id: 'r1',
  userId: 'u1',
  userName: 'Aman',
  entity,
  action,
  targetId: 't1',
  meta,
  createdAt: '2026-10-05T10:00:00.000Z',
});

describe('activitySentence', () => {
  it('describes a created product with its category and image count', () => {
    expect(
      activitySentence(
        row('PRODUCT', 'CREATE', {
          name: 'iPhone 15',
          category: 'Phones',
          images: 4,
        }),
        t,
      ),
    ).toBe(
      'activityProductCreate(name=iPhone 15): activityInCategory(category=Phones); activityImagesCount(count=4)',
    );
  });

  it('shows a price change as field, old value and new value', () => {
    expect(
      activitySentence(
        row('PRICE', 'UPDATE', {
          name: '128gb Black',
          changes: { price: { from: '340', to: '355' } },
        }),
        t,
      ),
    ).toBe(
      'activityPriceUpdate(name=128gb Black): activityFieldPrice: $340 → $355',
    );
  });

  it('formats TMT amounts, yes/no values and empty values', () => {
    const sentence = activitySentence(
      row('PRICE', 'UPDATE', {
        name: 'X',
        changes: {
          displayPriceTmt: { from: null, to: '6700' },
          outOfStock: { from: false, to: true },
        },
      }),
      t,
    );
    expect(sentence).toContain('activityFieldDisplayPriceTmt: — → 6700 TMT');
    expect(sentence).toContain('activityFieldOutOfStock: no → yes');
  });

  it('translates order statuses', () => {
    expect(
      activitySentence(
        row('ORDER', 'UPDATE', {
          orderNumber: 'ORD-1',
          kind: 'STATUS',
          changes: { status: { from: 'PENDING', to: 'IN_PROGRESS' } },
        }),
        t,
      ),
    ).toBe(
      'activityOrderStatus(orderNumber=ORD-1): activityFieldStatus: pending → inProgress',
    );
  });

  it('picks the order head by kind and keeps the cancel reason', () => {
    expect(
      activitySentence(
        row('ORDER', 'UPDATE', {
          orderNumber: 'ORD-1',
          kind: 'CANCEL',
          changes: { status: { from: 'PENDING', to: 'ADMIN_CANCELLED' } },
          reason: 'Out of stock',
        }),
        t,
      ),
    ).toContain('activityOrderCancel(orderNumber=ORD-1)');
    expect(
      activitySentence(
        row('ORDER', 'UPDATE', { orderNumber: 'ORD-1', kind: 'NOTES' }),
        t,
      ),
    ).toBe('activityOrderNotes(orderNumber=ORD-1)');
  });

  it('describes a rate change with the recalculated price count', () => {
    expect(
      activitySentence(
        row('CURRENCY_RATE', 'UPDATE', {
          name: 'Manat',
          currency: 'TMT',
          changes: { rate: { from: 19.5, to: 19.6 } },
          recalculatedPrices: 512,
        }),
        t,
      ),
    ).toBe(
      'activityRateUpdate(name=Manat): activityFieldRate: 19.5 → 19.6; activityRecalculated(count=512)',
    );
  });

  it('describes bulk price saves and rate moves', () => {
    expect(
      activitySentence(
        row('PRICE', 'UPDATE', { count: 40, fields: ['price', 'rate'] }),
        t,
      ),
    ).toBe(
      'activityPricesBulk(count=40): activityEditedFields(fields=activityFieldPrice, activityFieldRate)',
    );
    expect(
      activitySentence(
        row('PRICE', 'UPDATE', {
          count: 3,
          fields: ['rate'],
          rate: 'Wholesale',
        }),
        t,
      ),
    ).toBe('activityPricesMovedToRate(count=3,rate=Wholesale)');
  });

  it('describes a category tree delete with its size', () => {
    expect(
      activitySentence(
        row('CATEGORY', 'DELETE', {
          name: 'Phones',
          subcategories: 2,
          products: 30,
        }),
        t,
      ),
    ).toBe(
      'activityCategoryDelete(name=Phones): activitySubcategories(count=2); activityProductsCount(count=30)',
    );
  });

  it('picks the category reorder head by direction', () => {
    expect(
      activitySentence(
        row('CATEGORY', 'REORDER', { name: 'Phones', direction: 'up' }),
        t,
      ),
    ).toBe('activityCategoryMovedUp(name=Phones)');
    expect(
      activitySentence(
        row('CATEGORY', 'REORDER', { name: 'Phones', direction: 'down' }),
        t,
      ),
    ).toBe('activityCategoryMovedDown(name=Phones)');
  });

  it('lists edited fields and image changes on a product update', () => {
    expect(
      activitySentence(
        row('PRODUCT', 'UPDATE', {
          name: 'iPhone 15',
          changes: {},
          edited: ['description', 'tags'],
          imagesAdded: 2,
          imagesRemoved: 1,
        }),
        t,
      ),
    ).toBe(
      'activityProductUpdate(name=iPhone 15): activityEditedFields(fields=activityFieldDescription, activityFieldTags); activityImagesAdded(count=2); activityImagesRemoved(count=1)',
    );
  });

  it('names a banner by its position', () => {
    expect(activitySentence(row('BANNER', 'DELETE', { position: 2 }), t)).toBe(
      'activityBannerDelete(position=2)',
    );
  });

  it('survives missing meta', () => {
    expect(activitySentence(row('BRAND', 'CREATE', null), t)).toBe(
      'activityBrandCreate(name=)',
    );
  });
});

describe('formatActivityTime', () => {
  it('renders Ashgabat local time as DD.MM.YYYY HH:mm', () => {
    expect(formatActivityTime('2026-03-01T20:00:00Z')).toBe('02.03.2026 01:00');
  });
});

describe('formatActivityDay', () => {
  it('turns a YYYY-MM-DD day into DD.MM.YYYY', () => {
    expect(formatActivityDay('2026-03-02')).toBe('02.03.2026');
  });
});

describe('relativeSeen', () => {
  const now = new Date('2026-10-05T10:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it('handles never, just now, minutes, hours and days', () => {
    expect(relativeSeen(null, now, t)).toBe('activityNeverSeen');
    expect(relativeSeen(ago(20_000), now, t)).toBe('activityJustNow');
    expect(relativeSeen(ago(5 * 60_000), now, t)).toBe(
      'activityMinutesAgo(count=5)',
    );
    expect(relativeSeen(ago(3 * 3_600_000), now, t)).toBe(
      'activityHoursAgo(count=3)',
    );
    expect(relativeSeen(ago(2 * 86_400_000), now, t)).toBe(
      'activityDaysAgo(count=2)',
    );
  });
});

describe('heatmapGrid', () => {
  it('lays out Monday-first weeks and pads the first column', () => {
    // 2026-10-05 is a Monday; 2026-10-07 a Wednesday.
    const weeks = heatmapGrid([], '2026-10-07', '2026-10-13');
    expect(weeks).toHaveLength(2);
    expect(weeks[0].map((cell) => cell?.date ?? null)).toEqual([
      null,
      null,
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
    expect(weeks[1][0]?.date).toBe('2026-10-12');
    expect(weeks[1][1]?.date).toBe('2026-10-13');
    expect(weeks[1].slice(2).every((cell) => cell == null)).toBe(true);
  });

  it('scales levels to the busiest day, counting chats too', () => {
    const weeks = heatmapGrid(
      [
        { date: '2026-10-05', changes: 8, chats: 0 },
        { date: '2026-10-06', changes: 4, chats: 0 },
        { date: '2026-10-07', changes: 1, chats: 0 },
        { date: '2026-10-08', changes: 0, chats: 2 },
      ],
      '2026-10-05',
      '2026-10-11',
    );
    const level = (i: number) => weeks[0][i]?.level;
    expect(level(0)).toBe(4);
    expect(level(1)).toBe(2);
    expect(level(2)).toBe(1);
    expect(level(3)).toBe(1);
    expect(level(4)).toBe(0);
  });

  it('is all level 0 with no activity', () => {
    const weeks = heatmapGrid([], '2026-10-05', '2026-10-11');
    expect(weeks[0].every((cell) => cell?.level === 0)).toBe(true);
  });
});
