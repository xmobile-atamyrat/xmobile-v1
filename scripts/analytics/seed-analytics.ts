/**
 * Seeds the LOCAL database with realistic analytics data for developing and
 * testing the admin analytics dashboard:
 *
 * - raw `AnalyticsEvent` rows for the last N days (page views, product and
 *   category views on real catalog rows, searches incl. zero-result ones,
 *   cart adds, checkouts, chats, sign-ups), shaped by growth, weekday and
 *   Ashgabat time-of-day curves;
 * - a real `UserOrder` (+ items) behind every `order_placed` event;
 * - the `AnalyticsDaily` rollups for the whole period, after which raw events
 *   older than the retention window are pruned, as production would have it.
 *
 *   yarn seed:analytics-dev                       # 120 days, ~400 visitors/day
 *   yarn seed:analytics-dev --days 30 --seed 7
 *   yarn seed:analytics-dev --clean               # remove seed data, recompute rollups
 *
 * Seed data is tagged (see generate.ts) and re-running replaces it. The days
 * a run owns are recorded in a marker row (see safety.ts); re-seeding and
 * --clean rebuild rollups for those days only. The script refuses to run on
 * production or staging (NEXT_PUBLIC_APP_ENV) and on a database that holds
 * real history it would overwrite, unless --force is given. The generator
 * itself is pure and lives in ./generate.ts.
 */
import { Prisma } from '@prisma/client';

import {
  DAILY_ROLLUPS,
  refreshRevenue,
  rollupPeriods,
  rollupRange,
} from '../../src/lib/analytics/rollup';
import { pruneAnalyticsEvents } from '../../src/lib/analytics/retention';
import { rawWindowStart } from '../../src/lib/analytics/time';
import dbClient from '../../src/lib/dbClient';
import {
  whereActiveCategory,
  whereListableProduct,
} from '../../src/lib/prismaActiveScope';
import { checkDatabaseUrl, parseArgs, type SeedArgs, USAGE } from './args';
import {
  addDays,
  ashgabatDay,
  generateSeed,
  SEED_ORDER_NOTES,
  SEED_ORDER_PREFIX,
  SEED_UUID_PREFIX,
  type SeedCatalog,
  type SeedEvent,
  type SeedOrder,
} from './generate';
import {
  checkAppEnv,
  type DayRange,
  historyRefusals,
  MAX_FOREIGN_EVENTS,
  parseMarker,
  rangesOutside,
  SEED_MARKER_DIMENSION,
  SEED_MARKER_METRIC,
  seedRange,
  unionRanges,
} from './safety';

const EVENT_CHUNK = 5000; // × 9 columns, well under 65535 bind parameters
const ORDER_CHUNK = 1000;

const SEED_UUID_MIN = `${SEED_UUID_PREFIX}0000-0000-0000-0000-000000000000`;
const SEED_UUID_MAX = `${SEED_UUID_PREFIX}ffff-ffff-ffff-ffff-ffffffffffff`;
const isSeedVisitorSql = Prisma.sql`"visitorId" BETWEEN ${SEED_UUID_MIN}::uuid AND ${SEED_UUID_MAX}::uuid`;

const seedOrderWhere: Prisma.UserOrderWhereInput = {
  orderNumber: { startsWith: SEED_ORDER_PREFIX },
  notes: SEED_ORDER_NOTES,
};

/** Metrics recomputed from UserOrder alone: a rebuild never loses them. */
const ORDER_ONLY_METRICS = [
  ...new Set(
    DAILY_ROLLUPS.filter((r) => !r.reads.includes('events')).flatMap(
      (r) => r.metrics,
    ),
  ),
];

const dayText = (value: Date | string): string =>
  typeof value === 'string'
    ? value.slice(0, 10)
    : value.toISOString().slice(0, 10);

const fmt = (n: number | bigint) => Number(n).toLocaleString('en-US');

async function loadCatalog(): Promise<SeedCatalog> {
  const [products, categories, users] = await Promise.all([
    dbClient.product.findMany({
      where: { ...whereListableProduct, categories: whereActiveCategory },
      select: {
        id: true,
        slug: true,
        name: true,
        categoryId: true,
        cachedPrice: true,
        outOfStockAt: true,
      },
      orderBy: { id: 'asc' },
    }),
    dbClient.category.findMany({
      where: whereActiveCategory,
      select: { id: true, slug: true, predecessorId: true },
      orderBy: { id: 'asc' },
    }),
    dbClient.user.findMany({
      where: { deletedAt: null, grade: 'FREE' },
      select: { id: true, name: true, email: true },
      orderBy: { id: 'asc' },
      take: 500,
    }),
  ]);

  if (products.length === 0 || categories.length === 0) {
    throw new Error(
      `The local database has ${products.length} active product(s) with images and ${categories.length} active categor(y/ies). ` +
        'The seed needs real catalog rows to point events at: restore a backup (scripts/apply-backup-local.sh) or create a few categories and products in the admin UI, then run this again.',
    );
  }

  return {
    products: products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      categoryId: p.categoryId,
      priceTmt: p.cachedPrice,
      outOfStock: p.outOfStockAt != null,
    })),
    categories: categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      parentId: c.predecessorId,
    })),
    users,
  };
}

async function readMarker(): Promise<DayRange | null> {
  const rows = await dbClient.$queryRaw<{ day: Date; to: string }[]>`
    SELECT "day", "dimensionValue" AS "to" FROM "AnalyticsDaily"
    WHERE "metric" = ${SEED_MARKER_METRIC}`;
  return parseMarker(rows);
}

/** Replaces the marker with `range`, or removes it (null). */
async function writeMarker(range: DayRange | null): Promise<void> {
  await dbClient.$transaction([
    dbClient.$executeRaw`
      DELETE FROM "AnalyticsDaily" WHERE "metric" = ${SEED_MARKER_METRIC}`,
    ...(range
      ? [
          dbClient.$executeRaw`
            INSERT INTO "AnalyticsDaily" ("day", "metric", "dimension", "dimensionValue", "value")
            VALUES (${range.from}::date, ${SEED_MARKER_METRIC}, ${SEED_MARKER_DIMENSION}, ${range.to}, 1)`,
        ]
      : []),
  ]);
}

/**
 * The Ashgabat days the remaining seed events and orders touch (an order's
 * revenue lands on its completion day). Covers seed data whose marker is
 * missing: a run from before the marker existed, or one that crashed.
 */
async function seedDataSpan(): Promise<DayRange | null> {
  const [[events], [orders]] = await Promise.all([
    dbClient.$queryRaw<{ min: Date | null; max: Date | null }[]>`
      SELECT min("occurredAt") AS min, max("occurredAt") AS max
      FROM "AnalyticsEvent" WHERE ${isSeedVisitorSql}`,
    dbClient.$queryRaw<{ min: Date | null; max: Date | null }[]>`
      SELECT min("createdAt") AS min,
             max(GREATEST("createdAt", "updatedAt", "completedAt")) AS max
      FROM "UserOrder"
      WHERE "orderNumber" LIKE ${`${SEED_ORDER_PREFIX}%`}
        AND "notes" = ${SEED_ORDER_NOTES}`,
  ]);
  const span = (row: { min: Date | null; max: Date | null }) =>
    row.min && row.max
      ? { from: ashgabatDay(row.min), to: ashgabatDay(row.max) }
      : null;
  return unionRanges(span(events), span(orders));
}

/** Deletes every seed event and seed order. */
async function removeSeedData(): Promise<{ events: number; orders: number }> {
  const events = await dbClient.$executeRaw`
    DELETE FROM "AnalyticsEvent" WHERE ${isSeedVisitorSql}`;
  // Items go with their order (ON DELETE CASCADE).
  const { count: orders } = await dbClient.userOrder.deleteMany({
    where: seedOrderWhere,
  });
  return { events, orders };
}

/**
 * Days in `range`, older than the raw window and outside `owned`, with
 * non-zero event-based rollups: history a rebuild of `range` would destroy.
 */
async function findForeignRollupDays(
  range: DayRange,
  owned: DayRange | null,
  rawStart: string,
): Promise<string[]> {
  const to = range.to < rawStart ? range.to : addDays(rawStart, -1);
  if (to < range.from) return [];
  const rows = await dbClient.$queryRaw<{ day: Date }[]>`
    SELECT DISTINCT "day" FROM "AnalyticsDaily"
    WHERE "day" >= ${range.from}::date AND "day" <= ${to}::date
      AND "metric" NOT IN (${Prisma.join([SEED_MARKER_METRIC, ...ORDER_ONLY_METRICS])})
      AND "value" <> 0
      ${
        owned
          ? Prisma.sql`AND NOT ("day" >= ${owned.from}::date AND "day" <= ${owned.to}::date)`
          : Prisma.empty
      }
    ORDER BY "day"`;
  return rows.map((row) => dayText(row.day));
}

/** Non-seed raw events older than a day, counted up to MAX_FOREIGN_EVENTS + 1. */
async function countForeignEvents(): Promise<number> {
  const [{ count }] = await dbClient.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) AS count FROM (
      SELECT 1 FROM "AnalyticsEvent"
      WHERE NOT (${isSeedVisitorSql})
        AND "occurredAt" < (now() AT TIME ZONE 'UTC') - interval '1 day'
      LIMIT ${MAX_FOREIGN_EVENTS + 1}
    ) AS foreign_events`;
  return Number(count);
}

/**
 * Recomputes the rollups of `range`: every daily metric, the week and month
 * uniques of every period touching it (rollupPeriods stores complete periods
 * only and clears in-progress ones), and revenue for every day from
 * UserOrder (refreshRevenue, the source of truth, so real orders keep their
 * rows). Only rows dated inside `range` are deleted first (so values that no
 * longer exist, such as views of a seed product, don't linger); a week or
 * month starting before `range` is recomputed in place when its raw events
 * allow, and otherwise left alone.
 *
 * `ignoreRetention` is for the seed run, whose raw events older than the
 * retention window exist until the prune that follows. Without it (--clean),
 * days and periods older than the window keep only order-based metrics.
 */
async function rebuildRollups(
  range: DayRange,
  options: { ignoreRetention: boolean },
): Promise<number> {
  const { from, to } = range;
  await dbClient.$executeRaw`
    DELETE FROM "AnalyticsDaily"
    WHERE "day" >= ${from}::date AND "day" <= ${to}::date
      AND "metric" <> ${SEED_MARKER_METRIC}`;

  await rollupRange(from, to, options);
  await rollupPeriods(from, to, options);
  await refreshRevenue();

  const [{ count }] = await dbClient.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) AS count FROM "AnalyticsDaily"
    WHERE "day" >= ${from}::date AND "day" <= ${to}::date
      AND "metric" <> ${SEED_MARKER_METRIC}`;
  return Number(count);
}

const toEventRow = (e: SeedEvent): Prisma.AnalyticsEventCreateManyInput => ({
  occurredAt: e.occurredAt,
  name: e.name,
  visitorId: e.visitorId,
  sessionId: e.sessionId,
  userId: e.userId,
  entityId: e.entityId,
  platform: e.platform,
  locale: e.locale,
  props: e.props == null ? Prisma.DbNull : (e.props as Prisma.InputJsonObject),
});

async function insertEvents(events: SeedEvent[]): Promise<void> {
  for (let i = 0; i < events.length; i += EVENT_CHUNK) {
    // eslint-disable-next-line no-await-in-loop
    await dbClient.analyticsEvent.createMany({
      data: events.slice(i, i + EVENT_CHUNK).map(toEventRow),
    });
  }
}

const toOrderRow = (o: SeedOrder): Prisma.UserOrderCreateManyInput => ({
  id: o.id,
  orderNumber: o.orderNumber,
  status: o.status,
  totalPrice: o.totalPrice,
  userId: o.userId,
  guestSessionId: o.guestSessionId,
  userName: o.userName,
  userEmail: o.userEmail,
  deliveryAddress: o.deliveryAddress,
  deliveryPhone: o.deliveryPhone,
  notes: o.notes,
  adminNotes: o.adminNotes,
  cancelledAt: o.cancelledAt,
  cancelledBy: o.cancelledBy,
  cancellationReason: o.cancellationReason,
  completedAt: o.completedAt,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
});

async function insertOrders(orders: SeedOrder[]): Promise<void> {
  for (let i = 0; i < orders.length; i += ORDER_CHUNK) {
    const chunk = orders.slice(i, i + ORDER_CHUNK);
    // eslint-disable-next-line no-await-in-loop
    await dbClient.$transaction([
      dbClient.userOrder.createMany({
        data: chunk.map(toOrderRow),
      }),
      dbClient.userOrderItem.createMany({
        data: chunk.flatMap((o) => o.items),
      }),
    ]);
  }
}

function printCounts(title: string, counts: Map<string, number>) {
  console.log(title);
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([key, n]) =>
      console.log(`  ${key.padEnd(16)} ${fmt(n).padStart(9)}`),
    );
}

async function seed(
  args: SeedArgs,
  previous: DayRange | null,
  owned: DayRange,
  now: Date,
) {
  const catalog = await loadCatalog();
  console.log(
    `Catalog: ${catalog.products.length} products, ${catalog.categories.length} categories, ${catalog.users.length} users.`,
  );

  // Recorded first, covering the old and the new days, so a run that dies
  // half-way still leaves --clean knowing what to clean.
  await writeMarker(unionRanges(previous, owned));
  const removed = await removeSeedData();
  if (previous) {
    console.log(
      `Removed previous seed data: ${fmt(removed.events)} events, ${fmt(removed.orders)} orders (${previous.from} .. ${previous.to}).`,
    );
  }

  const eventCounts = new Map<string, number>();
  const orderCounts = new Map<string, number>();
  let totalEvents = 0;
  let totalOrders = 0;

  // eslint-disable-next-line no-restricted-syntax
  for (const { day, events, orders } of generateSeed(catalog, {
    days: args.days,
    visitorsPerDay: args.visitorsPerDay,
    seed: args.seed,
    now,
    orders: args.orders,
  })) {
    // Orders first: an order_placed event never points at a missing order.
    // eslint-disable-next-line no-await-in-loop
    await insertOrders(orders);
    // eslint-disable-next-line no-await-in-loop
    await insertEvents(events);
    events.forEach((e) =>
      eventCounts.set(e.name, (eventCounts.get(e.name) ?? 0) + 1),
    );
    orders.forEach((o) =>
      orderCounts.set(o.status, (orderCounts.get(o.status) ?? 0) + 1),
    );
    totalEvents += events.length;
    totalOrders += orders.length;
    process.stdout.write(
      `\rInserted ${day}: ${fmt(totalEvents)} events, ${fmt(totalOrders)} orders`,
    );
  }
  process.stdout.write('\n');

  // Days only the previous seed covered lose its numbers, keeping what real
  // data (orders, raw events still in the window) supports.
  // eslint-disable-next-line no-restricted-syntax
  for (const stale of previous ? rangesOutside(previous, owned) : []) {
    console.log(`Clearing earlier seed rollups ${stale.from} .. ${stale.to}…`);
    // eslint-disable-next-line no-await-in-loop
    await rebuildRollups(stale, { ignoreRetention: false });
  }
  console.log(`Rolling up ${owned.from} .. ${owned.to}…`);
  const rollupRows = await rebuildRollups(owned, { ignoreRetention: true });
  await writeMarker(owned);

  console.log('Pruning raw events past the retention window…');
  const pruned = await pruneAnalyticsEvents();

  const [{ remaining }] = await dbClient.$queryRaw<{ remaining: bigint }[]>`
    SELECT count(*) AS remaining FROM "AnalyticsEvent" WHERE ${isSeedVisitorSql}`;

  console.log('');
  printCounts(`Events generated (${fmt(totalEvents)}):`, eventCounts);
  printCounts(`Orders (${fmt(totalOrders)}):`, orderCounts);
  console.log(`Raw seed events kept after pruning: ${fmt(remaining)}`);
  console.log(
    `Prune result: ${JSON.stringify(pruned, (_, v) => (typeof v === 'bigint' ? Number(v) : v))}`,
  );
  console.log(
    `AnalyticsDaily rows for ${owned.from} .. ${owned.to}: ${fmt(rollupRows)} (recorded as ${SEED_MARKER_METRIC}).`,
  );
}

async function clean(previous: DayRange | null) {
  const removed = await removeSeedData();
  if (!previous) {
    await writeMarker(null);
    console.log('No seed data found.');
    return;
  }
  console.log(
    `Removed seed data: ${fmt(removed.events)} events, ${fmt(removed.orders)} orders.`,
  );
  console.log(`Recomputing rollups ${previous.from} .. ${previous.to}…`);
  await rebuildRollups(previous, { ignoreRetention: false });
  await writeMarker(null);
}

/** Prints the refusals; true when the run may go on (none, or --force). */
function allowed(reasons: string[], force: boolean): boolean {
  if (reasons.length === 0) return true;
  const lines = reasons.map((reason) => `  - ${reason}`).join('\n');
  if (!force) {
    console.error(`Refusing to run:\n${lines}\nPass --force to run anyway.`);
    process.exitCode = 1;
    return false;
  }
  console.warn(`--force: running anyway, although:\n${lines}`);
  return true;
}

async function main() {
  let args: SeedArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error((error as Error).message);
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const check = checkDatabaseUrl(process.env.DATABASE_URL);
  const setupReasons = [
    checkAppEnv(process.env.NEXT_PUBLIC_APP_ENV),
    check.ok ? null : check.reason,
  ].filter((reason): reason is string => reason != null);
  if (!allowed(setupReasons, args.force)) return;
  if (check.host) console.log(`Database host: ${check.host}`);

  const started = Date.now();
  const now = new Date();
  // Everything earlier seed runs may have left numbers in.
  const previous = unionRanges(await readMarker(), await seedDataSpan());

  if (args.clean) {
    await clean(previous);
  } else {
    const today = ashgabatDay(now);
    const owned = seedRange(addDays(today, -(args.days - 1)), today);
    const [foreignRollupDays, foreignEvents] = await Promise.all([
      findForeignRollupDays(owned, previous, rawWindowStart(now)),
      countForeignEvents(),
    ]);
    if (
      !allowed(
        historyRefusals({ foreignRollupDays, foreignEvents }),
        args.force,
      )
    ) {
      return;
    }
    await seed(args, previous, owned, now);
  }
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => dbClient.$disconnect());
