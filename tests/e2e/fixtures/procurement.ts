/**
 * Users and procurement data seeded in {@link ../seed-e2e-procurement.ts};
 * keep in sync with that file. Ids are fixed so specs can deep-link with
 * `/procurement?order=<id>`.
 */
export const E2E_PASSWORD = 'e2e-procurement-password';

export const E2E_USERS = {
  superuser: {
    id: '66666666-e2e0-4666-b666-666666666666',
    email: 'e2e-superuser@xmobile.test',
    name: 'E2E Superuser',
    grade: 'SUPERUSER',
  },
  free: {
    id: '77777777-e2e0-4777-b777-777777777777',
    email: 'e2e-free-user@xmobile.test',
    name: 'E2E Free User',
    grade: 'FREE',
  },
} as const;

export type E2eUserKey = keyof typeof E2E_USERS;

export const E2E_PROCUREMENT = {
  /** Newest order, so it is also what `/procurement` opens by default. */
  mainOrder: {
    id: '88888888-e2e0-4888-b888-888888888801',
    name: 'E2E Закупка Ноябрь',
  },
  /** Older order, used to check switching orders from the orders sheet. */
  secondOrder: {
    id: '88888888-e2e0-4888-b888-888888888802',
    name: 'E2E Закупка Октябрь',
  },
  /** Throwaway order the catalog test adds a product to. */
  catalogOrder: {
    id: '88888888-e2e0-4888-b888-888888888803',
    name: 'E2E Закупка Каталог',
  },
  products: {
    /** Long on purpose: it must wrap instead of widening the page. */
    longName: 'E2E iPhone 15 Pro Max 256GB Natural Titanium Dual eSIM',
    galaxy: 'E2E Samsung Galaxy S24 Ultra 512GB',
    airpods: 'E2E AirPods Pro 2',
    /** Only in the second order. */
    pixel: 'E2E Google Pixel 9 Pro',
    /** In the catalog but in no order: found by the catalog search. */
    catalogOnly: 'E2E Anker Charger 65W',
  },
  suppliers: {
    storeA: 'E2E Store Ashgabat Mobile',
    storeB: 'E2E Store Dubai Wholesale',
    /** Only in the second order. */
    storeC: 'E2E Store Istanbul Trade',
  },
} as const;
