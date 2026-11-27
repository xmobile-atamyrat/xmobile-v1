/**
 * Pure generator for `seed-analytics.ts`: turns a catalog snapshot (real
 * products, categories and users read from the DB) into realistic
 * `AnalyticsEvent` rows and matching `UserOrder`s. No I/O here, so it can be
 * unit-tested and is deterministic for a given seed, catalog and `now`.
 *
 * Everything it produces is tagged so it can be found and removed again:
 * every UUID starts with SEED_UUID_PREFIX, every order number with
 * SEED_ORDER_PREFIX, and every order has `notes = SEED_ORDER_NOTES`.
 */
import {
  type EventName,
  type EventProps,
  splitEntity,
} from '../../src/lib/analytics/events';

export const SEED_UUID_PREFIX = '5eed';
export const SEED_ORDER_PREFIX = 'SEED-';
export const SEED_ORDER_NOTES = 'analytics-seed';

/** Asia/Ashgabat is UTC+5 all year (no DST). */
export const ASHGABAT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// PRNG and sampling helpers
// ---------------------------------------------------------------------------

export type Rng = () => number;

/** mulberry32: small, fast, good enough for test data, and deterministic. */
export function createRng(seed: number): Rng {
  // eslint-disable-next-line no-bitwise
  let a = seed >>> 0;
  return () => {
    /* eslint-disable no-bitwise */
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    /* eslint-enable no-bitwise */
  };
}

export const randInt = (rng: Rng, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1));

export const pick = <T>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)];

/** Picks a key of `weights` with probability proportional to its value. */
export function pickWeighted<K extends string>(
  rng: Rng,
  weights: Record<K, number>,
): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (let i = 0; i < entries.length; i += 1) {
    r -= entries[i][1];
    if (r < 0) return entries[i][0];
  }
  return entries[entries.length - 1][0];
}

/** Cumulative-weight table for O(log n) sampling from a long list. */
interface WeightedTable<T> {
  readonly size: number;
  sample(rng: Rng): T;
}

function weightedTable<T>(items: T[], weights: number[]): WeightedTable<T> {
  const cumulative: number[] = [];
  let total = 0;
  weights.forEach((w) => {
    total += w;
    cumulative.push(total);
  });
  return {
    size: items.length,
    sample(rng) {
      const r = rng() * total;
      let lo = 0;
      let hi = cumulative.length - 1;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (cumulative[mid] > r) hi = mid;
        else lo = mid + 1;
      }
      return items[lo];
    },
  };
}

/** A v4-shaped UUID whose first 4 hex digits are SEED_UUID_PREFIX. */
export function seedUuid(rng: Rng): string {
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(rng() * 16).toString(16)).join(
      '',
    );
  const variant = (8 + Math.floor(rng() * 4)).toString(16);
  return `${SEED_UUID_PREFIX}${hex(4)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}

export const isSeedUuid = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.startsWith(SEED_UUID_PREFIX);

// ---------------------------------------------------------------------------
// Ashgabat calendar days ('YYYY-MM-DD')
// ---------------------------------------------------------------------------

/** The Ashgabat calendar day `date` falls on. */
export const ashgabatDay = (date: Date): string =>
  new Date(date.getTime() + ASHGABAT_OFFSET_MS).toISOString().slice(0, 10);

/** The UTC instant at which Ashgabat day `day` starts (its local midnight). */
export const ashgabatDayStart = (day: string): Date =>
  new Date(Date.parse(`${day}T00:00:00Z`) - ASHGABAT_OFFSET_MS);

export const addDays = (day: string, n: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS)
    .toISOString()
    .slice(0, 10);

/** 0 = Sunday … 6 = Saturday. */
export const dayOfWeek = (day: string): number =>
  new Date(`${day}T00:00:00Z`).getUTCDay();

/** The `days` consecutive days ending with `lastDay`, oldest first. */
export const dayRange = (lastDay: string, days: number): string[] =>
  Array.from({ length: days }, (_, i) => addDays(lastDay, i - days + 1));

/** Every day from `from` to `to`, inclusive. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The Monday of the ISO week `day` is in. */
export const weekStart = (day: string): string =>
  addDays(day, -((dayOfWeek(day) + 6) % 7));

export const monthStart = (day: string): string => `${day.slice(0, 7)}-01`;

/**
 * One representative day per week and per month touched by [from, to]: the
 * period starts, clamped to `from`. Feeding each to `rollupPeriodUniques`
 * recomputes every week and month uniques row the range touches.
 */
export function periodDays(from: string, to: string): string[] {
  const out = new Set<string>();
  daysBetween(from, to).forEach((d) => {
    const w = weekStart(d);
    const m = monthStart(d);
    out.add(w < from ? from : w);
    out.add(m < from ? from : m);
  });
  return [...out].sort();
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export interface SeedProduct {
  id: string;
  slug: string;
  /** As stored on Product: usually a JSON string of per-locale names. */
  name: string;
  categoryId: string;
  /** Shown TMT price (Product.cachedPrice), or null when unknown. */
  priceTmt: number | null;
  outOfStock: boolean;
}

export interface SeedCategory {
  id: string;
  slug: string;
  parentId: string | null;
}

export interface SeedUser {
  id: string;
  name: string;
  email: string;
}

export interface SeedCatalog {
  products: SeedProduct[];
  categories: SeedCategory[];
  users: SeedUser[];
}

export type SeedPlatform = 'WEB' | 'APP';
export type SeedOrderStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'ON_THE_WAY'
  | 'COMPLETED'
  | 'USER_CANCELLED'
  | 'ADMIN_CANCELLED';

export interface SeedEvent {
  occurredAt: Date;
  name: EventName;
  visitorId: string;
  sessionId: string;
  userId: string | null;
  entityId: string | null;
  platform: SeedPlatform;
  locale: string;
  props: Record<string, unknown> | null;
}

export interface SeedOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productPrice: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeedOrder {
  id: string;
  orderNumber: string;
  status: SeedOrderStatus;
  totalPrice: string;
  userId: string | null;
  guestSessionId: string | null;
  userName: string | null;
  userEmail: string | null;
  deliveryAddress: string;
  deliveryPhone: string;
  notes: string;
  adminNotes: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: SeedOrderItem[];
}

export interface SeedDay {
  day: string;
  events: SeedEvent[];
  orders: SeedOrder[];
}

export interface GenerateOptions {
  /** Number of days, ending with the Ashgabat day of `now`. */
  days: number;
  /** Average visitors per day over the period; the trend grows around it. */
  visitorsPerDay: number;
  seed: number;
  /** Nothing is generated after this instant (today is only partly filled). */
  now: Date;
  /** Whether checkouts happen (`order_placed` + a real UserOrder). */
  orders: boolean;
}

// ---------------------------------------------------------------------------
// Distributions
// ---------------------------------------------------------------------------

export const LOCALE_WEIGHTS = { ru: 50, tk: 30, en: 10, tr: 5, ch: 5 };
export const APP_SHARE = 0.6;

const DEVICE_WEIGHTS: Record<SeedPlatform, Record<string, number>> = {
  APP: { mobile: 88, tablet: 12, desktop: 0 },
  WEB: { mobile: 55, desktop: 38, tablet: 7 },
};

// '' = no external referrer (direct visit, typed URL, app launch).
const REFERRER_WEIGHTS: Record<SeedPlatform, Record<string, number>> = {
  WEB: {
    '': 55,
    'google.com': 17,
    'yandex.ru': 10,
    'instagram.com': 8,
    'tiktok.com': 5,
    't.me': 5,
  },
  APP: {
    '': 92,
    't.me': 3,
    'instagram.com': 3,
    'tiktok.com': 2,
  },
};

/** Relative traffic by Ashgabat local hour 0–23: quiet nights, evening peak. */
export const HOUR_WEIGHTS = [
  2.0, 1.2, 0.7, 0.4, 0.3, 0.3, 0.6, 1.4, 2.8, 4.0, 4.8, 5.2, 5.6, 5.4, 5.0,
  4.8, 4.9, 5.2, 5.8, 6.6, 7.4, 7.6, 6.4, 4.0,
];

/** Traffic multiplier by day of week, Sunday first: weekend peak, Friday dip. */
export const WEEKDAY_FACTORS = [1.18, 1.0, 1.02, 1.0, 0.97, 0.9, 1.1];

const HOUR_TABLE = weightedTable(
  HOUR_WEIGHTS.map((_, h) => h),
  HOUR_WEIGHTS,
);

/** Growth over the period: 0.65× at the start to 1.35× at the end (avg 1). */
export const growthFactor = (t: number): number => 0.65 + 0.7 * t;

interface SearchQuery {
  q: string;
  /** Lowercase substrings matched against product names to count results. */
  match?: string[];
  /** Something we don't stock: always `results: 0`. */
  zero?: boolean;
}

const SEARCH_QUERIES: SearchQuery[] = [
  // ru
  { q: 'айфон', match: ['iphone'] },
  { q: 'iphone 16 pro max', match: ['iphone 16 pro max'] },
  { q: 'самсунг', match: ['samsung'] },
  { q: 'наушники', match: ['airpods', 'buds', 'headphone', 'наушник'] },
  { q: 'airpods', match: ['airpods'] },
  { q: 'чехол', match: ['чехол', 'case'] },
  { q: 'зарядка', match: ['заряд', 'charger', 'adapter'] },
  { q: 'смарт часы', match: ['watch'] },
  { q: 'планшет', match: ['ipad', 'tab', 'pad'] },
  { q: 'колонка jbl', match: ['jbl'] },
  { q: 'редми', match: ['redmi'] },
  { q: 'ноутбук', match: ['macbook', 'laptop', 'book'] },
  { q: 'плейстейшн 5', match: ['playstation'] },
  { q: 'повербанк', match: ['power', 'bank'] },
  // tk
  { q: 'telefon' },
  { q: 'arzan telefon', match: ['redmi', 'tecno', 'spark', 'nokia'] },
  { q: 'nauşnik', match: ['airpods', 'buds', 'headphone'] },
  { q: 'sagat', match: ['watch'] },
  { q: 'planşet', match: ['ipad', 'tab', 'pad'] },
  { q: 'zarýadka', match: ['charger', 'adapter', 'заряд'] },
  { q: 'çehol', match: ['case', 'чехол'] },
  // en
  { q: 'iphone 15', match: ['iphone 15'] },
  { q: 'samsung s25 ultra', match: ['s25'] },
  { q: 'galaxy a56', match: ['a56', 'a55'] },
  { q: 'redmi note 14', match: ['redmi note'] },
  { q: 'apple watch', match: ['apple watch', 'watch'] },
  { q: 'ipad', match: ['ipad'] },
  { q: 'macbook air', match: ['macbook'] },
  { q: 'tecno', match: ['tecno'] },
  { q: 'honor', match: ['honor'] },
  { q: 'xiaomi', match: ['xiaomi', 'redmi', 'poco'] },
  { q: 'ps5', match: ['playstation'] },
  // Not stocked
  { q: 'google pixel 9', zero: true },
  { q: 'nokia 3310', zero: true },
  { q: 'oneplus 13', zero: true },
  { q: 'айфон 19', zero: true },
  { q: 'garmin', zero: true },
  { q: 'dyson фен', zero: true },
  { q: 'steam deck', zero: true },
  { q: 'gopro', zero: true },
  { q: 'стекло на камеру', zero: true },
  { q: 'sony xperia', zero: true },
  { q: 'nothing phone 3', zero: true },
  { q: 'kompýuter syçanjygy', zero: true },
];

// Hits follow a power law by list position; the zero-result queries together
// get roughly 13% of searches.
const SEARCH_TABLE = (() => {
  const hits = SEARCH_QUERIES.filter((s) => !s.zero);
  const zeros = SEARCH_QUERIES.filter((s) => s.zero);
  const hitW = hits.map((_, i) => 1 / (i + 1) ** 0.8);
  const zeroW = zeros.map((_, i) => 1 / (i + 1) ** 0.8);
  const hitSum = hitW.reduce((a, b) => a + b, 0);
  const zeroSum = zeroW.reduce((a, b) => a + b, 0);
  return weightedTable(
    [...hits, ...zeros],
    [
      ...hitW.map((w) => (w / hitSum) * 0.87),
      ...zeroW.map((w) => (w / zeroSum) * 0.13),
    ],
  );
})();

const GUEST_NAMES = [
  'Merdan',
  'Aýna',
  'Döwlet',
  'Maral',
  'Serdar',
  'Gülşat',
  'Batyr',
  'Jeren',
  'Арслан',
  'Алина',
  'Дмитрий',
  'Ольга',
  'Мурад',
  'Selbi',
  'Kerim',
];

const ADDRESSES = [
  'Aşgabat, Bitarap Türkmenistan şaýoly 45',
  'Aşgabat, Andalyp köçesi 12',
  'Ашхабад, ул. Магтымгулы 120, кв 8',
  'Ашхабад, 30 мкр, дом 4',
  'Mary şäheri, Gurbansoltan eje köçesi 7',
  'Türkmenabat, Magtymguly köçesi 33',
  'Daşoguz şäheri',
  'Balkanabat, 2-nji kiçi etrap',
  'Aşgabat, Parahat 7, jaý 15',
];

const ADMIN_CANCEL_REASONS = [
  'Нет в наличии',
  'Клиент не отвечает',
  'Müşderi jogap bermedi',
  null,
];

// ---------------------------------------------------------------------------
// Prepared catalog
// ---------------------------------------------------------------------------

interface PreparedProduct extends SeedProduct {
  price: number;
  searchNames: string[];
  path: string;
}

interface PreparedCategory extends SeedCategory {
  path: string;
  children: PreparedCategory[];
  products: WeightedTable<PreparedProduct> | null;
}

interface Prepared {
  products: WeightedTable<PreparedProduct>;
  allProducts: PreparedProduct[];
  byId: Map<string, PreparedProduct>;
  categories: WeightedTable<PreparedCategory>;
  users: SeedUser[];
}

function searchNamesOf(name: string): string[] {
  try {
    const parsed: unknown = JSON.parse(name);
    if (parsed && typeof parsed === 'object') {
      return [
        ...new Set(
          Object.values(parsed as Record<string, unknown>)
            .filter((v): v is string => typeof v === 'string')
            .map((v) => v.toLowerCase()),
        ),
      ];
    }
  } catch {
    // Plain string name.
  }
  return [name.toLowerCase()];
}

function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A believable TMT price for a product without one: 150–25 000, mostly low. */
const plausiblePrice = (rng: Rng): number =>
  Math.round((150 * Math.exp(rng() * Math.log(25000 / 150))) / 10) * 10;

const POPULARITY_EXPONENT = 1.05;

function prepareCatalog(catalog: SeedCatalog, rng: Rng): Prepared {
  if (catalog.products.length === 0) {
    throw new Error('Catalog has no products.');
  }
  if (catalog.categories.length === 0) {
    throw new Error('Catalog has no categories.');
  }

  // Popularity is a power law over a random (seeded) ranking.
  const ranked = shuffled(rng, catalog.products).map(
    (p): PreparedProduct => ({
      ...p,
      price: p.priceTmt && p.priceTmt > 0 ? p.priceTmt : plausiblePrice(rng),
      searchNames: searchNamesOf(p.name),
      path: `/product/${p.slug}`,
    }),
  );
  const weightOf = new Map<string, number>();
  ranked.forEach((p, i) => {
    weightOf.set(p.id, 1 / (i + 1) ** POPULARITY_EXPONENT);
  });

  const byCategory = new Map<string, PreparedProduct[]>();
  ranked.forEach((p) => {
    const list = byCategory.get(p.categoryId) ?? [];
    list.push(p);
    byCategory.set(p.categoryId, list);
  });

  const categoryIds = new Set(catalog.categories.map((c) => c.id));
  const prepared = new Map<string, PreparedCategory>();
  catalog.categories.forEach((c) => {
    const products = byCategory.get(c.id);
    prepared.set(c.id, {
      ...c,
      path: '',
      children: [],
      products: products
        ? weightedTable(
            products,
            products.map((p) => weightOf.get(p.id) ?? 0),
          )
        : null,
    });
  });
  prepared.forEach((c) => {
    if (c.parentId && categoryIds.has(c.parentId)) {
      prepared.get(c.parentId)!.children.push(c);
    }
  });

  // A category with subcategories renders /category/[slug]; a leaf lists its
  // products at /product-category/[slug]. Empty leaves get no traffic.
  const visible = [...prepared.values()].filter(
    (c) => c.children.length > 0 || c.products,
  );
  visible.forEach((c) => {
    // eslint-disable-next-line no-param-reassign
    c.path =
      c.children.length > 0
        ? `/category/${c.slug}`
        : `/product-category/${c.slug}`;
  });
  prepared.forEach((c) => {
    // eslint-disable-next-line no-param-reassign
    c.children = c.children.filter((child) => child.path !== '');
  });
  if (visible.length === 0) {
    throw new Error('No category has products or subcategories.');
  }

  // Categories follow their own power law, also over a seeded ranking.
  const rankedCategories = shuffled(rng, visible);
  return {
    products: weightedTable(
      ranked,
      ranked.map((p) => weightOf.get(p.id) ?? 0),
    ),
    allProducts: ranked,
    byId: new Map(ranked.map((p) => [p.id, p])),
    categories: weightedTable(
      rankedCategories,
      rankedCategories.map((_, i) => 1 / (i + 1) ** POPULARITY_EXPONENT),
    ),
    users: catalog.users,
  };
}

// ---------------------------------------------------------------------------
// Visitors and sessions
// ---------------------------------------------------------------------------

interface Visitor {
  id: string;
  platform: SeedPlatform;
  locale: string;
  device: 'mobile' | 'tablet' | 'desktop';
  user: SeedUser | null;
  /** 0–1: how likely this visitor is to come back on a given day. */
  loyalty: number;
}

/** Share of new visitors who are logged in as an existing user. */
const LOGGED_IN_SHARE = 0.15;
/** Probability of `cart_add` after viewing an in-stock product. */
const CART_ADD_RATE = 0.08;
/** Probability of checking out when a visitor with a cart opens /cart. */
const CHECKOUT_FROM_CART_RATE = 0.45;
/** Probability of checking out at the end of a session with a cart. */
const CHECKOUT_AT_END_RATE = 0.1;

function newVisitor(rng: Rng, users: SeedUser[]): Visitor {
  const platform: SeedPlatform = rng() < APP_SHARE ? 'APP' : 'WEB';
  return {
    id: seedUuid(rng),
    platform,
    locale: pickWeighted(rng, LOCALE_WEIGHTS),
    device: pickWeighted(rng, DEVICE_WEIGHTS[platform]) as Visitor['device'],
    user: users.length > 0 && rng() < LOGGED_IN_SHARE ? pick(rng, users) : null,
    loyalty: 0.1 + 0.9 * rng() ** 3,
  };
}

/** An event before its absolute time is known: `gap` ms after the previous one. */
interface Draft {
  gap: number;
  name: EventName;
  props: Record<string, unknown>;
}

interface CheckoutDraft {
  /** Index in the session's drafts of the order_placed event. */
  draftIndex: number;
  cart: Map<string, number>;
}

const gapPage = (rng: Rng) => 4_000 + Math.round(rng() ** 2 * 110_000);
const gapInstant = (rng: Rng) => 50 + Math.round(rng() * 700);

type Step =
  | 'product'
  | 'category'
  | 'search'
  | 'home'
  | 'sale'
  | 'cart'
  | 'favorites'
  | 'orders'
  | 'user'
  | 'chat'
  | 'support'
  | 'signup'
  | 'privacy';

class SessionBuilder {
  readonly drafts: Draft[] = [];

  readonly cart = new Map<string, number>();

  readonly checkouts: CheckoutDraft[] = [];

  private category: PreparedCategory | null = null;

  private readonly rng: Rng;

  private readonly cat: Prepared;

  private readonly visitor: Visitor;

  private readonly ordersEnabled: boolean;

  constructor(
    rng: Rng,
    cat: Prepared,
    visitor: Visitor,
    ordersEnabled: boolean,
  ) {
    this.rng = rng;
    this.cat = cat;
    this.visitor = visitor;
    this.ordersEnabled = ordersEnabled;
  }

  private push<N extends EventName>(
    gap: number,
    name: N,
    props: EventProps<N>,
  ) {
    this.drafts.push({ gap, name, props: props as Record<string, unknown> });
  }

  private pageView(gap: number, path: string, referrer?: string) {
    this.push(gap, 'page_view', {
      path,
      ...(referrer ? { referrer } : {}),
      device: this.visitor.device,
    });
  }

  private viewProduct(
    gap: number,
    product: PreparedProduct,
    referrer?: string,
  ) {
    this.pageView(gap, product.path, referrer);
    this.push(gapInstant(this.rng), 'product_view', { productId: product.id });
    if (!product.outOfStock && this.rng() < CART_ADD_RATE) {
      const qty = pickWeighted(this.rng, { 1: 90, 2: 8, 3: 2 });
      this.push(10_000 + Math.round(this.rng() * 80_000), 'cart_add', {
        productId: product.id,
        qty: Number(qty),
      });
      this.cart.set(product.id, (this.cart.get(product.id) ?? 0) + Number(qty));
    }
  }

  private viewCategory(
    gap: number,
    category: PreparedCategory,
    referrer?: string,
  ) {
    this.category = category;
    this.pageView(gap, category.path, referrer);
    this.push(gapInstant(this.rng), 'category_view', {
      categoryId: category.id,
    });
  }

  private nextProduct(): PreparedProduct {
    if (this.category?.products && this.rng() < 0.65) {
      return this.category.products.sample(this.rng);
    }
    return this.cat.products.sample(this.rng);
  }

  private nextCategory(): PreparedCategory {
    if (
      this.category &&
      this.category.children.length > 0 &&
      this.rng() < 0.6
    ) {
      return pick(this.rng, this.category.children);
    }
    return this.cat.categories.sample(this.rng);
  }

  private search(gap: number) {
    const query = SEARCH_TABLE.sample(this.rng);
    let matches: PreparedProduct[] = [];
    let results = 0;
    if (!query.zero) {
      const terms = query.match ?? [];
      matches = this.cat.allProducts.filter((p) =>
        p.searchNames.some((n) => terms.some((t) => n.includes(t))),
      );
      results = matches.length > 0 ? matches.length : randInt(this.rng, 3, 40);
    }
    this.pageView(gap, '/product');
    this.push(gapInstant(this.rng), 'search', { q: query.q, results });
    if (results > 0 && this.rng() < 0.65) {
      // Matches are in popularity order, so favour the top of the list.
      const product =
        matches.length > 0
          ? matches[Math.floor(matches.length * this.rng() ** 2)]
          : this.cat.products.sample(this.rng);
      this.viewProduct(gapPage(this.rng), product);
    }
  }

  private doCheckout() {
    this.pageView(gapPage(this.rng), '/cart/checkout');
    this.push(30_000 + Math.round(this.rng() * 150_000), 'order_placed', {
      // Filled in once the order id is known (see generateSession).
      orderId: '',
    });
    this.checkouts.push({
      draftIndex: this.drafts.length - 1,
      cart: new Map(this.cart),
    });
    this.cart.clear();
    this.pageView(
      1_000 + Math.round(this.rng() * 2_000),
      '/cart/checkout/success',
    );
  }

  landing() {
    const referrer = pickWeighted(
      this.rng,
      REFERRER_WEIGHTS[this.visitor.platform],
    );
    const fromSearchEngine =
      referrer === 'google.com' || referrer === 'yandex.ru';
    const landing = pickWeighted(
      this.rng,
      fromSearchEngine
        ? { home: 25, product: 55, category: 18, sale: 2, support: 0 }
        : { home: 52, product: 22, category: 18, sale: 5, support: 3 },
    );
    const ref = referrer || undefined;
    if (landing === 'product') {
      this.viewProduct(0, this.cat.products.sample(this.rng), ref);
    } else if (landing === 'category') {
      this.viewCategory(0, this.cat.categories.sample(this.rng), ref);
    } else {
      this.pageView(
        0,
        { home: '/', sale: '/sale', support: '/support' }[landing],
        ref,
      );
    }
  }

  step() {
    const loggedIn = this.visitor.user != null;
    const step = pickWeighted<Step>(this.rng, {
      product: 38,
      category: 20,
      search: 12,
      home: 7,
      sale: 4,
      cart: this.cart.size > 0 ? 14 : 3,
      favorites: 2,
      orders: loggedIn ? 2 : 0,
      user: 2,
      chat: 1.5,
      support: 0.8,
      signup: loggedIn ? 0 : 1.2,
      privacy: 0.3,
    });
    const gap = gapPage(this.rng);
    switch (step) {
      case 'product':
        this.viewProduct(gap, this.nextProduct());
        break;
      case 'category':
        this.viewCategory(gap, this.nextCategory());
        break;
      case 'search':
        this.search(gap);
        break;
      case 'cart':
        this.pageView(gap, '/cart');
        if (
          this.ordersEnabled &&
          this.cart.size > 0 &&
          this.rng() < CHECKOUT_FROM_CART_RATE
        ) {
          this.doCheckout();
        }
        break;
      case 'chat':
        this.pageView(gap, '/chat');
        if (this.rng() < 0.7) {
          this.push(
            5_000 + Math.round(this.rng() * 35_000),
            'chat_started',
            {},
          );
        }
        break;
      case 'signup':
        this.pageView(gap, '/user/signup');
        if (this.rng() < 0.45) {
          this.push(30_000 + Math.round(this.rng() * 90_000), 'signup', {});
        }
        break;
      default:
        this.pageView(
          gap,
          {
            home: '/',
            sale: '/sale',
            favorites: '/favorites',
            orders: '/orders',
            user: '/user',
            support: '/support',
            privacy: '/privacy-policy',
          }[step],
        );
    }
  }

  finish() {
    if (
      this.ordersEnabled &&
      this.cart.size > 0 &&
      this.rng() < CHECKOUT_AT_END_RATE
    ) {
      this.pageView(gapPage(this.rng), '/cart');
      this.doCheckout();
    }
  }
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

const yyyymmdd = (date: Date) => ashgabatDay(date).replace(/-/g, '');

const minDate = (a: Date, b: Date) => (a.getTime() <= b.getTime() ? a : b);

function buildOrder(
  rng: Rng,
  cat: Prepared,
  visitor: Visitor,
  cart: Map<string, number>,
  createdAt: Date,
  now: Date,
  seq: number,
): SeedOrder {
  const id = seedUuid(rng);
  const items: SeedOrderItem[] = [...cart.entries()].map(([productId, qty]) => {
    const product = cat.byId.get(productId)!;
    return {
      id: seedUuid(rng),
      orderId: id,
      productId,
      productName: product.name,
      productPrice: String(product.price),
      quantity: qty,
      createdAt,
      updatedAt: createdAt,
    };
  });
  const total = items.reduce(
    (sum, item) => sum + Number(item.productPrice) * item.quantity,
    0,
  );

  const guestSessionId = visitor.user ? null : seedUuid(rng);
  const pickup = rng() < 0.35;
  const ms = (h: number) => h * 60 * 60 * 1000;
  const at = (offset: number) => new Date(createdAt.getTime() + offset);

  let status: SeedOrderStatus;
  let completedAt: Date | null = null;
  let cancelledAt: Date | null = null;
  let cancelledBy: string | null = null;
  let cancellationReason: string | null = null;
  let updatedAt = createdAt;

  const roll = rng();
  if (roll < 0.18) {
    // Cancelled a few minutes to a day after placing it.
    const byUser = roll < 0.11;
    status = byUser ? 'USER_CANCELLED' : 'ADMIN_CANCELLED';
    cancelledAt = minDate(at(ms(0.1 + rng() * 20)), now);
    cancelledBy = byUser ? visitor.user?.id ?? guestSessionId : null;
    cancellationReason = byUser ? null : pick(rng, ADMIN_CANCEL_REASONS);
    updatedAt = cancelledAt;
  } else {
    // Delivered 2 h – 3 days later, most within a day.
    const delay = ms(4 + rng() ** 1.5 * 68);
    if (createdAt.getTime() + delay <= now.getTime()) {
      status = 'COMPLETED';
      completedAt = at(delay);
      updatedAt = completedAt;
    } else {
      const progress = (now.getTime() - createdAt.getTime()) / delay;
      if (progress < 0.25) status = 'PENDING';
      else if (progress < 0.7) status = 'IN_PROGRESS';
      else status = 'ON_THE_WAY';
      updatedAt =
        status === 'PENDING'
          ? createdAt
          : at((now.getTime() - createdAt.getTime()) / 2);
    }
  }

  return {
    id,
    orderNumber: `${SEED_ORDER_PREFIX}${yyyymmdd(createdAt)}-${String(seq).padStart(4, '0')}`,
    status,
    totalPrice: total.toFixed(2),
    userId: visitor.user?.id ?? null,
    guestSessionId,
    userName: visitor.user?.name ?? pick(rng, GUEST_NAMES),
    userEmail: visitor.user?.email ?? null,
    deliveryAddress: pickup ? 'PICKUP' : pick(rng, ADDRESSES),
    deliveryPhone: `+9936${randInt(rng, 1, 5)}${String(randInt(rng, 0, 999999)).padStart(6, '0')}`,
    notes: SEED_ORDER_NOTES,
    adminNotes: null,
    cancelledAt,
    cancelledBy,
    cancellationReason,
    completedAt,
    createdAt,
    updatedAt,
    items,
  };
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

function toEvent(
  draft: Draft,
  occurredAt: Date,
  visitor: Visitor,
  sessionId: string,
): SeedEvent {
  // Same split the real ingestion does, so entityId/props look identical.
  const { entityId, props } = splitEntity(draft.name, draft.props);
  return {
    occurredAt,
    name: draft.name,
    visitorId: visitor.id,
    sessionId,
    userId: visitor.user?.id ?? null,
    entityId,
    platform: visitor.platform,
    locale: visitor.locale,
    props,
  };
}

/**
 * Generates the whole period one Ashgabat day at a time, oldest first, so the
 * caller can insert day by day. Deterministic for the same catalog + options.
 */
export function* generateSeed(
  catalog: SeedCatalog,
  options: GenerateOptions,
): Generator<SeedDay> {
  const rng = createRng(options.seed);
  const cat = prepareCatalog(catalog, rng);
  const nowMs = options.now.getTime();
  const days = dayRange(ashgabatDay(options.now), options.days);

  // A couple of promo days with a traffic spike, for a livelier chart.
  const spikeDays = new Set(
    days.length > 14
      ? [pick(rng, days.slice(0, -7)), pick(rng, days.slice(0, -7))]
      : [],
  );

  const pool: Visitor[] = [];
  const counter = { orders: 0 };

  for (let di = 0; di < days.length; di += 1) {
    const day = days[di];
    const dayStartMs = ashgabatDayStart(day).getTime();
    const dayEndMs = dayStartMs + DAY_MS;
    const t = days.length > 1 ? di / (days.length - 1) : 1;

    const target = Math.max(
      1,
      Math.round(
        options.visitorsPerDay *
          growthFactor(t) *
          WEEKDAY_FACTORS[dayOfWeek(day)] *
          (spikeDays.has(day) ? 1.6 : 1) *
          (0.92 + rng() * 0.16),
      ),
    );

    // Returning visitors: biased towards recent and loyal ones.
    const todays: Visitor[] = [];
    const seen = new Set<string>();
    const returningTarget = Math.min(
      Math.round(target * (0.25 + 0.2 * t)),
      pool.length,
    );
    for (
      let attempts = 0;
      todays.length < returningTarget && attempts < returningTarget * 8;
      attempts += 1
    ) {
      const v = pool[pool.length - 1 - Math.floor(pool.length * rng() ** 2)];
      if (!seen.has(v.id) && rng() < v.loyalty) {
        seen.add(v.id);
        todays.push(v);
      }
    }
    while (todays.length < target) {
      const v = newVisitor(rng, cat.users);
      pool.push(v);
      todays.push(v);
    }

    const events: SeedEvent[] = [];
    const orders: SeedOrder[] = [];

    todays.forEach((visitor) => {
      const sessions = Number(pickWeighted(rng, { 1: 88, 2: 10, 3: 2 }));
      for (let s = 0; s < sessions; s += 1) {
        const builder = new SessionBuilder(rng, cat, visitor, options.orders);
        builder.landing();
        const steps = Math.min(14, Math.floor(-Math.log(1 - rng()) * 2.6));
        for (let i = 0; i < steps; i += 1) builder.step();
        builder.finish();

        // Place the session in the day, by the hourly curve, fully inside it.
        const duration = builder.drafts.reduce((sum, d) => sum + d.gap, 0);
        let start =
          dayStartMs +
          HOUR_TABLE.sample(rng) * 3_600_000 +
          Math.floor(rng() * 3_600_000);
        if (start + duration >= dayEndMs) {
          start = dayEndMs - 1 - duration - Math.floor(rng() * 600_000);
        }
        start = Math.max(start, dayStartMs);
        // Today is only filled up to `now`; whatever comes later never happened.
        if (start <= nowMs) {
          const sessionId = seedUuid(rng);
          let ms = start;
          const placed: SeedEvent[] = [];
          const placedOrders: SeedOrder[] = [];
          for (let i = 0; i < builder.drafts.length; i += 1) {
            const draft = builder.drafts[i];
            ms += draft.gap;
            if (ms > nowMs) break;
            const checkout = builder.checkouts.find((c) => c.draftIndex === i);
            if (checkout) {
              counter.orders += 1;
              const order = buildOrder(
                rng,
                cat,
                visitor,
                checkout.cart,
                new Date(ms - 200),
                options.now,
                counter.orders,
              );
              placedOrders.push(order);
              draft.props = { orderId: order.id };
            }
            placed.push(toEvent(draft, new Date(ms), visitor, sessionId));
          }
          events.push(...placed);
          orders.push(...placedOrders);
        }
      }
    });

    events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    yield { day, events, orders };
  }
}
