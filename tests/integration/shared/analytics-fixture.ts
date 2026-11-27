import {
  AnalyticsPlatform,
  Prisma,
  PrismaClient,
  UserOrderStatus,
} from '@prisma/client';

import type { IntegrationCatalog } from './integration-types';

/**
 * Known raw events and orders for the analytics rollup/metric integration
 * tests. Ashgabat is UTC+5: local day D runs from (D-1) 19:00 UTC to D 19:00.
 *
 * The clock is pinned to NOW (2025-02-05 12:00 local), so the raw window
 * starts 2024-11-08 and the main days below are inside it. The October 2024
 * days are outside it and exercise the approximate paths. Dates are far from
 * the real clock so orders other integration files create can't land in them.
 *
 * Visitors per local day (main data):
 * - 2025-01-26 (Sun): E
 * - 2025-01-27 (Mon, D1): A, B, C, D
 * - 2025-01-28: E
 * - 2025-01-31 (Fri): A, F, H
 * - 2025-02-01 (Sat): A, G, H
 * - 2025-02-03 (Mon): A
 * ISO week 2025-01-27..02-02: A B C D E F G H = 8; Jan 2025: A B C D E F H = 7;
 * Feb 2025: A G H = 3.
 */

export const NOW = new Date('2025-02-05T07:00:00Z');

/**
 * The analytics SQL must not depend on the session TimeZone (the columns are
 * zone-less UTC timestamps). The analytics integration tests connect with a
 * far-off zone to prove it: `-c TimeZone=…` in libpq's `options` parameter,
 * which Prisma passes through.
 */
export const SESSION_TIME_ZONE = 'Asia/Seoul';

export function withSessionTimeZone(databaseUrl: string): string {
  const options = encodeURIComponent(`-c TimeZone=${SESSION_TIME_ZONE}`);
  return `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}options=${options}`;
}

/**
 * The integration worker's database URL with SESSION_TIME_ZONE, also set as
 * DATABASE_URL so the app's Prisma singleton (created on first import) uses
 * it. Call right after prepareIntegrationWorker.
 */
export function useSessionTimeZone(databaseUrl: string): string {
  const url = withSessionTimeZone(databaseUrl);
  process.env.DATABASE_URL = url;
  return url;
}
export const OLD_NOW = new Date('2024-10-10T07:00:00Z');
export const D1 = '2025-01-27';

export const ORDER_PREFIX = 'AN-TEST-';

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

export const V = {
  A: uuid(0xa),
  B: uuid(0xb),
  C: uuid(0xc),
  D: uuid(0xd),
  E: uuid(0xe),
  F: uuid(0xf),
  G: uuid(0x10),
  H: uuid(0x11),
  X: uuid(0x20),
  Y: uuid(0x21),
};

const S = {
  A1: uuid(0x1a),
  B1: uuid(0x1b),
  C1: uuid(0x1c),
};

export interface AnalyticsFixture {
  p1: string;
  p1Slug: string;
  p2: string;
  p3: string;
  catA: string;
  catASlug: string;
  catB: string;
  catBSlug: string;
  orders: Record<'o1' | 'o2' | 'o3' | 'o4' | 'o5' | 'o6' | 'o7' | 'o8', string>;
}

type Ev = {
  at: string;
  name: string;
  v: string;
  s?: string;
  entity?: string;
  platform?: AnalyticsPlatform;
  locale?: string;
  props?: Prisma.InputJsonValue;
};

const toRow = (e: Ev): Prisma.AnalyticsEventCreateManyInput => ({
  occurredAt: new Date(e.at),
  name: e.name,
  visitorId: e.v,
  sessionId: e.s ?? null,
  entityId: e.entity ?? null,
  platform: e.platform ?? 'WEB',
  locale: e.locale ?? 'ru',
  ...(e.props === undefined ? {} : { props: e.props }),
});

export async function wipeAnalytics(prisma: PrismaClient): Promise<void> {
  await prisma.analyticsEvent.deleteMany({});
  await prisma.analyticsDaily.deleteMany({});
}

export async function insertEvents(
  prisma: PrismaClient,
  events: Ev[],
): Promise<void> {
  await prisma.analyticsEvent.createMany({ data: events.map(toRow) });
}

export async function cleanupAnalyticsFixture(
  prisma: PrismaClient,
): Promise<void> {
  await prisma.userOrder.deleteMany({
    where: { orderNumber: { startsWith: ORDER_PREFIX } },
  });
  await prisma.product.deleteMany({
    where: { slug: { startsWith: 'an-test-' } },
  });
  await prisma.category.deleteMany({
    where: { slug: { startsWith: 'an-test-' }, predecessorId: { not: null } },
  });
  await prisma.category.deleteMany({
    where: { slug: { startsWith: 'an-test-' } },
  });
}

export async function seedAnalyticsFixture(
  prisma: PrismaClient,
  catalog: IntegrationCatalog,
): Promise<AnalyticsFixture> {
  await wipeAnalytics(prisma);
  await cleanupAnalyticsFixture(prisma);

  const catA = await prisma.category.create({
    data: { name: '{"en":"Phones","ru":"Телефоны"}', slug: 'an-test-cat-a' },
  });
  const catB = await prisma.category.create({
    data: {
      name: '{"en":"Smartphones"}',
      slug: 'an-test-cat-b',
      predecessorId: catA.id,
      imgUrl: '/srv/media/category/smart.webp',
    },
  });
  const p2 = await prisma.product.create({
    data: {
      slug: 'an-test-deleted-phone',
      name: '{"ru":"Удалённый","en":"Deleted phone"}',
      categoryId: catalog.categoryId,
      brandId: catalog.brandId,
      imgUrls: [],
      tags: [],
      videoUrls: [],
      deletedAt: new Date('2025-01-30T00:00:00Z'),
    },
  });

  const order = (
    n: number,
    status: UserOrderStatus,
    totalPrice: string,
    completedAt: string | null,
  ) =>
    prisma.userOrder.create({
      data: {
        orderNumber: `${ORDER_PREFIX}${n}`,
        status,
        totalPrice,
        deliveryAddress: 'Ashgabat',
        deliveryPhone: '+99360000000',
        completedAt: completedAt ? new Date(completedAt) : null,
      },
    });

  const orders = {
    // D1 (2025-01-27 local)
    o1: (await order(1, 'COMPLETED', '1305.50', '2025-01-27T10:00:00Z')).id,
    o2: (await order(2, 'PENDING', '700', null)).id,
    // 19:00 UTC on the 26th is 00:00 on the 27th in Ashgabat.
    o3: (await order(3, 'COMPLETED', '200', '2025-01-26T19:00:00Z')).id,
    // A millisecond earlier is still the 26th.
    o4: (await order(4, 'COMPLETED', '999', '2025-01-26T18:59:59.999Z')).id,
    // Unparseable total: counts as an order, adds 0 revenue.
    o5: (await order(5, 'COMPLETED', 'abc', '2025-01-27T12:00:00Z')).id,
    // Left COMPLETED with a stale completedAt: not revenue.
    o6: (await order(6, 'ADMIN_CANCELLED', '5000', '2025-01-27T11:00:00Z')).id,
    o7: (await order(7, 'COMPLETED', '100', '2025-02-01T05:00:00Z')).id,
    o8: (await order(8, 'COMPLETED', '300', '2025-02-02T05:00:00Z')).id,
  };

  const p1 = catalog.productId;
  const p3 = 'missing-product';

  await insertEvents(prisma, [
    // 2025-01-26 local, last millisecond.
    { at: '2025-01-26T18:59:59.999Z', name: 'page_view', v: V.E },

    // D1 = 2025-01-27 local.
    {
      at: '2025-01-26T19:00:00.000Z',
      name: 'page_view',
      v: V.A,
      s: S.A1,
      props: { path: '/', device: 'mobile', referrer: 'www.Google.com' },
    },
    {
      at: '2025-01-27T05:00:00Z',
      name: 'product_view',
      v: V.A,
      s: S.A1,
      entity: p1,
    },
    {
      at: '2025-01-27T05:01:00Z',
      name: 'category_view',
      v: V.A,
      s: S.A1,
      entity: catA.id,
    },
    {
      at: '2025-01-27T05:10:00Z',
      name: 'cart_add',
      v: V.A,
      s: S.A1,
      entity: p1,
      props: { qty: 3 },
    },
    {
      at: '2025-01-27T05:20:00Z',
      name: 'order_placed',
      v: V.A,
      s: S.A1,
      entity: orders.o1,
    },
    {
      at: '2025-01-27T06:00:00Z',
      name: 'page_view',
      v: V.B,
      s: S.B1,
      platform: 'APP',
      locale: 'tk',
      props: { path: '/' },
    },
    {
      at: '2025-01-27T06:01:00Z',
      name: 'page_view',
      v: V.B,
      s: S.B1,
      platform: 'APP',
      locale: 'tk',
      props: { path: '/x', referrer: 'yandex.ru' },
    },
    // B adds to the cart well before viewing the product (more than the
    // funnel's 2-minute clock slack): not a funnel step 2.
    {
      at: '2025-01-27T05:55:00Z',
      name: 'cart_add',
      v: V.B,
      s: S.B1,
      entity: p2.id,
      platform: 'APP',
      locale: 'tk',
      props: { qty: 1 },
    },
    {
      at: '2025-01-27T06:03:00Z',
      name: 'product_view',
      v: V.B,
      s: S.B1,
      entity: p2.id,
      platform: 'APP',
      locale: 'tk',
    },
    {
      at: '2025-01-27T10:00:00Z',
      name: 'product_view',
      v: V.C,
      s: S.C1,
      entity: p1,
      locale: 'en',
    },
    {
      at: '2025-01-27T10:05:00Z',
      name: 'cart_add',
      v: V.C,
      s: S.C1,
      entity: p1,
      locale: 'en',
      props: { qty: 1 },
    },
    {
      at: '2025-01-27T10:10:00Z',
      name: 'order_placed',
      v: V.C,
      s: S.C1,
      entity: orders.o2,
      locale: 'en',
    },
    // 18:59:59 UTC is 23:59:59 local: still D1.
    {
      at: '2025-01-27T18:59:59.000Z',
      name: 'page_view',
      v: V.C,
      s: S.C1,
      locale: 'en',
      props: { path: '/', device: 'desktop' },
    },
    {
      at: '2025-01-27T11:00:00Z',
      name: 'search',
      v: V.D,
      props: { q: '  iPhone   15 ', results: 3 },
    },
    {
      at: '2025-01-27T11:01:00Z',
      name: 'search',
      v: V.D,
      props: { q: 'iphone 15', results: 0 },
    },
    {
      at: '2025-01-27T11:02:00Z',
      name: 'search',
      v: V.D,
      props: { q: 'Samsung', results: 0 },
    },
    {
      at: '2025-01-27T11:02:30Z',
      name: 'search',
      v: V.D,
      props: { q: '   ', results: 0 },
    },
    {
      at: '2025-01-27T11:03:00Z',
      name: 'category_view',
      v: V.D,
      entity: catA.id,
    },
    {
      at: '2025-01-27T11:04:00Z',
      name: 'category_view',
      v: V.D,
      entity: catB.id,
    },
    {
      at: '2025-01-27T11:05:00Z',
      name: 'product_view',
      v: V.D,
      entity: p3,
    },

    // 19:00 UTC on the 27th is already 2025-01-28 local.
    { at: '2025-01-27T19:00:00.000Z', name: 'page_view', v: V.E },

    // 2025-01-31 local.
    { at: '2025-01-31T03:00:00Z', name: 'page_view', v: V.A },
    { at: '2025-01-31T03:01:00Z', name: 'product_view', v: V.A, entity: p1 },
    { at: '2025-01-31T04:00:00Z', name: 'page_view', v: V.F, platform: 'APP' },
    { at: '2025-01-31T05:00:00Z', name: 'product_view', v: V.H, entity: p1 },

    // 2025-02-01 local: H finishes the journey started the day before.
    { at: '2025-02-01T03:00:00Z', name: 'page_view', v: V.A },
    { at: '2025-02-01T04:00:00Z', name: 'page_view', v: V.G },
    {
      at: '2025-02-01T05:00:00Z',
      name: 'cart_add',
      v: V.H,
      entity: p1,
      props: { qty: 1 },
    },
    {
      at: '2025-02-01T05:30:00Z',
      name: 'order_placed',
      v: V.H,
      entity: orders.o8,
    },

    // 2025-02-03 local (next ISO week).
    { at: '2025-02-03T03:00:00Z', name: 'page_view', v: V.A },
  ]);

  return {
    p1,
    p1Slug: catalog.productSlug,
    p2: p2.id,
    p3,
    catA: catA.id,
    catASlug: catA.slug,
    catB: catB.id,
    catBSlug: catB.slug,
    orders,
  };
}

/**
 * October 2024: outside the raw window at NOW. Rolled up with OLD_NOW while
 * the raw events "still existed". X views a product on the 7th and adds it to
 * the cart on the 8th (a cross-day journey the daily funnels can't see).
 */
export const OLD_EVENTS: Ev[] = [
  { at: '2024-10-07T05:00:00Z', name: 'page_view', v: V.X, s: uuid(0x30) },
  { at: '2024-10-07T05:01:00Z', name: 'product_view', v: V.X, entity: 'old-p' },
  {
    at: '2024-10-07T06:00:00Z',
    name: 'page_view',
    v: V.Y,
    platform: 'APP',
    s: uuid(0x31),
  },
  {
    at: '2024-10-08T05:00:00Z',
    name: 'cart_add',
    v: V.X,
    entity: 'old-p',
    props: { qty: 1 },
  },
  { at: '2024-10-08T05:01:00Z', name: 'page_view', v: V.X, s: uuid(0x32) },
];
