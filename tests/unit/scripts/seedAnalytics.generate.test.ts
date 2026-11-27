import { describe, expect, it } from 'vitest';

import { events as eventSchemas } from '@/lib/analytics/events';

import {
  addDays,
  ashgabatDay,
  ashgabatDayStart,
  createRng,
  dayRange,
  generateSeed,
  periodDays,
  SEED_ORDER_NOTES,
  SEED_ORDER_PREFIX,
  type SeedCatalog,
  type SeedDay,
  seedUuid,
  weekStart,
} from '../../../scripts/analytics/generate';

const categories = [
  { id: 'cat-phones', slug: 'phones', parentId: null },
  { id: 'cat-apple', slug: 'apple', parentId: 'cat-phones' },
  { id: 'cat-samsung', slug: 'samsung', parentId: 'cat-phones' },
  { id: 'cat-audio', slug: 'audio', parentId: null },
  { id: 'cat-empty', slug: 'empty', parentId: null },
];

const names = [
  'iPhone 16 Pro Max',
  'iPhone 15',
  'Samsung Galaxy S25 Ultra',
  'Samsung Galaxy A56',
  'AirPods Pro 2',
  'JBL Charge 5',
  'Redmi Note 14',
  'Apple Watch Series 10',
];

const catalog: SeedCatalog = {
  products: Array.from({ length: 40 }, (_, i) => {
    const name = `${names[i % names.length]} ${i}`;
    return {
      id: `prod-${i}`,
      slug: `product-${i}`,
      name: JSON.stringify({ ru: name, en: name, tk: name }),
      categoryId: ['cat-apple', 'cat-samsung', 'cat-audio'][i % 3],
      priceTmt: i % 4 === 0 ? null : 500 + i * 100,
      outOfStock: i % 10 === 9,
    };
  }),
  categories,
  users: Array.from({ length: 20 }, (_, i) => ({
    id: `user-${i}`,
    name: `User ${i}`,
    email: `user${i}@example.com`,
  })),
};

// 18:30 Ashgabat on 2026-11-27, so today is only partly filled.
const NOW = new Date('2026-11-27T13:30:00Z');

const run = (overrides: Partial<Parameters<typeof generateSeed>[1]> = {}) => [
  ...generateSeed(catalog, {
    days: 21,
    visitorsPerDay: 150,
    seed: 7,
    now: NOW,
    orders: true,
    ...overrides,
  }),
];

const allEvents = (days: SeedDay[]) => days.flatMap((d) => d.events);
const allOrders = (days: SeedDay[]) => days.flatMap((d) => d.orders);

const generated = run();
const events = allEvents(generated);
const orders = allOrders(generated);

describe('day helpers', () => {
  it('maps Ashgabat days to UTC (UTC+5)', () => {
    expect(ashgabatDayStart('2026-11-27').toISOString()).toBe(
      '2026-11-26T19:00:00.000Z',
    );
    expect(ashgabatDay(new Date('2026-11-26T18:59:59.999Z'))).toBe(
      '2026-11-26',
    );
    expect(ashgabatDay(new Date('2026-11-26T19:00:00.000Z'))).toBe(
      '2026-11-27',
    );
  });

  it('lists ranges and period starts', () => {
    expect(dayRange('2026-03-02', 3)).toEqual([
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekStart('2026-11-29')).toBe('2026-11-23'); // Sunday -> Monday
    expect(periodDays('2026-10-28', '2026-11-03')).toEqual([
      '2026-10-28',
      '2026-11-01',
      '2026-11-02',
    ]);
  });
});

describe('generateSeed', () => {
  it('is deterministic for the same seed and different for another', () => {
    const again = run();
    expect(allEvents(again)).toEqual(events);
    expect(allOrders(again)).toEqual(orders);

    const other = allEvents(run({ seed: 8 }));
    expect(other.map((e) => e.visitorId)).not.toEqual(
      events.map((e) => e.visitorId),
    );
  });

  it('yields one entry per requested day, ending today', () => {
    expect(generated.map((d) => d.day)).toEqual(dayRange('2026-11-27', 21));
  });

  it('keeps every timestamp inside its Ashgabat day and before now', () => {
    generated.forEach(({ day, events: dayEvents, orders: dayOrders }) => {
      dayEvents.forEach((e) => {
        expect(ashgabatDay(e.occurredAt)).toBe(day);
        expect(e.occurredAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
      });
      dayOrders.forEach((o) => {
        expect(ashgabatDay(o.createdAt)).toBe(day);
        expect(o.updatedAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
        if (o.completedAt) {
          expect(o.completedAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
        }
      });
      for (let i = 1; i < dayEvents.length; i += 1) {
        expect(dayEvents[i].occurredAt >= dayEvents[i - 1].occurredAt).toBe(
          true,
        );
      }
    });
    const today = generated[generated.length - 1];
    expect(today.events.length).toBeGreaterThan(0);
    // 18:30 local: a good part of the day's traffic hasn't happened yet.
    expect(today.events.length).toBeLessThan(
      generated[generated.length - 8].events.length,
    );
  });

  it('tags everything with the seed prefixes', () => {
    events.forEach((e) => {
      expect(e.visitorId).toMatch(/^5eed[0-9a-f]{4}-[0-9a-f]{4}-4/);
      expect(e.sessionId.startsWith('5eed')).toBe(true);
    });
    expect(orders.length).toBeGreaterThan(0);
    orders.forEach((o) => {
      expect(o.id.startsWith('5eed')).toBe(true);
      expect(o.orderNumber.startsWith(SEED_ORDER_PREFIX)).toBe(true);
      expect(o.notes).toBe(SEED_ORDER_NOTES);
      if (o.guestSessionId)
        expect(o.guestSessionId.startsWith('5eed')).toBe(true);
      o.items.forEach((item) => {
        expect(item.id.startsWith('5eed')).toBe(true);
        expect(item.orderId).toBe(o.id);
      });
    });
    expect(new Set(orders.map((o) => o.orderNumber)).size).toBe(orders.length);
  });

  it('stores entityId/props the way splitEntity does and passes the catalog schemas', () => {
    events.forEach((e) => {
      const key = {
        product_view: 'productId',
        category_view: 'categoryId',
        cart_add: 'productId',
        order_placed: 'orderId',
      }[e.name as string];
      const full = key
        ? { ...(e.props ?? {}), [key]: e.entityId }
        : { ...(e.props ?? {}) };
      expect(eventSchemas[e.name].safeParse(full).success).toBe(true);
      if (key) expect(e.entityId).toBeTruthy();
      else expect(e.entityId).toBeNull();
      if (e.props) expect(Object.keys(e.props).length).toBeGreaterThan(0);
    });
  });

  it('points at real catalog rows and skips empty categories', () => {
    const productIds = new Set(catalog.products.map((p) => p.id));
    const slugs = new Set(catalog.products.map((p) => p.slug));
    events.forEach((e) => {
      if (e.name === 'product_view' || e.name === 'cart_add') {
        expect(productIds.has(e.entityId!)).toBe(true);
      }
      if (e.name === 'category_view') {
        expect(e.entityId).not.toBe('cat-empty');
      }
      if (e.name === 'page_view') {
        const path = e.props!.path as string;
        if (path.startsWith('/product/')) {
          expect(slugs.has(path.slice('/product/'.length))).toBe(true);
        }
        expect(path).not.toContain('empty');
      }
    });
    // Parent categories render /category, leaves /product-category.
    const paths = new Set(
      events
        .filter((e) => e.name === 'page_view')
        .map((e) => e.props!.path as string),
    );
    expect(paths.has('/category/phones')).toBe(true);
    expect(paths.has('/product-category/apple')).toBe(true);
    expect(paths.has('/product-category/phones')).toBe(false);
  });

  it('follows the funnel within each session', () => {
    const bySession = new Map<string, typeof events>();
    events.forEach((e) => {
      const list = bySession.get(e.sessionId) ?? [];
      list.push(e);
      bySession.set(e.sessionId, list);
    });
    const orderById = new Map(orders.map((o) => [o.id, o]));
    let placed = 0;
    bySession.forEach((list) => {
      expect(new Set(list.map((e) => e.visitorId)).size).toBe(1);
      const viewed = new Set<string>();
      const carted = new Set<string>();
      list.forEach((e) => {
        if (e.name === 'product_view') viewed.add(e.entityId!);
        if (e.name === 'cart_add') {
          expect(viewed.has(e.entityId!)).toBe(true);
          carted.add(e.entityId!);
        }
        if (e.name === 'order_placed') {
          placed += 1;
          expect(carted.size).toBeGreaterThan(0);
          const order = orderById.get(e.entityId!);
          expect(order).toBeDefined();
          order!.items.forEach((item) =>
            expect(carted.has(item.productId)).toBe(true),
          );
          expect(order!.userId).toBe(e.userId);
          carted.clear();
        }
      });
    });
    expect(placed).toBe(orders.length);
  });

  it('builds plausible orders', () => {
    orders.forEach((o) => {
      const sum = o.items.reduce(
        (s, i) => s + Number(i.productPrice) * i.quantity,
        0,
      );
      expect(o.totalPrice).toBe(sum.toFixed(2));
      expect(Number(o.totalPrice)).toBeGreaterThan(0);
      if (o.status === 'COMPLETED') {
        const delayH =
          (o.completedAt!.getTime() - o.createdAt.getTime()) / 3_600_000;
        expect(delayH).toBeGreaterThan(0);
        expect(delayH).toBeLessThanOrEqual(72);
      } else {
        expect(o.completedAt).toBeNull();
      }
      if (o.status.endsWith('CANCELLED')) expect(o.cancelledAt).not.toBeNull();
      if (['PENDING', 'IN_PROGRESS', 'ON_THE_WAY'].includes(o.status)) {
        expect(NOW.getTime() - o.createdAt.getTime()).toBeLessThan(
          73 * 3_600_000,
        );
      }
    });
    const completed = orders.filter((o) => o.status === 'COMPLETED').length;
    expect(completed / orders.length).toBeGreaterThan(0.6);
  });

  it('has roughly the requested distributions', () => {
    const visitors = new Map<string, (typeof events)[number]>();
    events.forEach((e) => visitors.set(e.visitorId, e));
    const share = (pred: (e: (typeof events)[number]) => boolean) =>
      [...visitors.values()].filter(pred).length / visitors.size;

    expect(share((e) => e.platform === 'APP')).toBeGreaterThan(0.54);
    expect(share((e) => e.platform === 'APP')).toBeLessThan(0.66);
    expect(share((e) => e.locale === 'ru')).toBeGreaterThan(0.44);
    expect(share((e) => e.locale === 'ru')).toBeLessThan(0.56);
    expect(share((e) => e.locale === 'tk')).toBeGreaterThan(0.25);
    expect(share((e) => e.locale === 'tk')).toBeLessThan(0.35);
    expect(share((e) => e.userId != null)).toBeGreaterThan(0.08);

    const searches = events.filter((e) => e.name === 'search');
    const zero = searches.filter((e) => e.props!.results === 0).length;
    expect(zero / searches.length).toBeGreaterThan(0.07);
    expect(zero / searches.length).toBeLessThan(0.2);

    const pageViews = events.filter((e) => e.name === 'page_view');
    const withReferrer = pageViews.filter((e) => e.props!.referrer).length;
    expect(withReferrer).toBeGreaterThan(0);
    expect(withReferrer / pageViews.length).toBeLessThan(0.2);

    // Returning visitors: some visitor ids show up on several days.
    const daysPerVisitor = new Map<string, Set<string>>();
    events.forEach((e) => {
      const set = daysPerVisitor.get(e.visitorId) ?? new Set();
      set.add(ashgabatDay(e.occurredAt));
      daysPerVisitor.set(e.visitorId, set);
    });
    const returning = [...daysPerVisitor.values()].filter((s) => s.size > 1);
    expect(returning.length / daysPerVisitor.size).toBeGreaterThan(0.05);

    // Product popularity is skewed: the top 10% of products get far more
    // than 10% of views.
    const views = new Map<string, number>();
    events
      .filter((e) => e.name === 'product_view')
      .forEach((e) =>
        views.set(e.entityId!, (views.get(e.entityId!) ?? 0) + 1),
      );
    const sorted = [...views.values()].sort((a, b) => b - a);
    const total = sorted.reduce((a, b) => a + b, 0);
    const top = sorted.slice(0, 4).reduce((a, b) => a + b, 0);
    expect(top / total).toBeGreaterThan(0.25);
  });

  it('grows over the period', () => {
    const firstWeek = generated
      .slice(0, 7)
      .reduce((s, d) => s + d.events.length, 0);
    const lastFullWeek = generated
      .slice(-8, -1)
      .reduce((s, d) => s + d.events.length, 0);
    expect(lastFullWeek).toBeGreaterThan(firstWeek);
  });

  it('places no orders with orders disabled', () => {
    const noOrders = run({ orders: false });
    expect(allOrders(noOrders)).toHaveLength(0);
    expect(allEvents(noOrders).some((e) => e.name === 'order_placed')).toBe(
      false,
    );
    expect(allEvents(noOrders).some((e) => e.name === 'cart_add')).toBe(true);
  });

  it('rejects an empty catalog', () => {
    expect(() => run({}).length).not.toThrow();
    expect(() => [
      ...generateSeed(
        { ...catalog, products: [] },
        { days: 1, visitorsPerDay: 1, seed: 1, now: NOW, orders: true },
      ),
    ]).toThrow(/no products/);
  });
});

describe('seedUuid', () => {
  it('produces valid, prefixed, deterministic UUIDs', () => {
    const a = createRng(1);
    const b = createRng(1);
    const ids = Array.from({ length: 50 }, () => seedUuid(a));
    expect(Array.from({ length: 50 }, () => seedUuid(b))).toEqual(ids);
    ids.forEach((id) =>
      expect(id).toMatch(
        /^5eed[0-9a-f]{4}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
    );
  });
});
