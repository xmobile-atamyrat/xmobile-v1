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
 * Seed data is tagged (see generate.ts) and re-running replaces it. The
 * generator itself is pure and lives in ./generate.ts.
 */
import { Prisma } from '@prisma/client';

import {
  rollupPeriodUniques,
  rollupRange,
} from '../../src/lib/analytics/rollup';
import { STORED } from '../../src/lib/analytics/metrics/stored';
import { pruneAnalyticsEvents } from '../../src/lib/analytics/retention';
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
  monthStart,
  periodDays,
  SEED_ORDER_NOTES,
  SEED_ORDER_PREFIX,
  SEED_UUID_PREFIX,
  type SeedCatalog,
  type SeedEvent,
  type SeedOrder,
  weekStart,
} from './generate';

const EVENT_CHUNK = 5000; // × 9 columns, well under 65535 bind parameters
const ORDER_CHUNK = 1000;

const SEED_UUID_MIN = `${SEED_UUID_PREFIX}0000-0000-0000-0000-000000000000`;
const SEED_UUID_MAX = `${SEED_UUID_PREFIX}ffff-ffff-ffff-ffff-ffffffffffff`;
const isSeedVisitorSql = Prisma.sql`"visitorId" BETWEEN ${SEED_UUID_MIN}::uuid AND ${SEED_UUID_MAX}::uuid`;

const seedOrderWhere: Prisma.UserOrderWhereInput = {
  orderNumber: { startsWith: SEED_ORDER_PREFIX },
  notes: SEED_ORDER_NOTES,
};

const minDay = (...days: (string | null | undefined)[]): string | null =>
  days.filter((d): d is string => !!d).sort()[0] ?? null;

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

/**
 * Deletes every seed event and seed order. Returns the first day whose
 * rollups may contain seed numbers, or null when there was no seed data.
 *
 * Seed events older than the retention window were pruned after the last
 * seed, so the days they covered can't be found from raw data. The earliest
 * rollup day is included for that reason: on a local database every rollup
 * older than the raw window comes from a seed run.
 */
async function removeSeedData(): Promise<{
  from: string | null;
  events: number;
  orders: number;
}> {
  const [[eventRange], firstOrder, [dailyRange]] = await Promise.all([
    dbClient.$queryRaw<{ min: Date | null }[]>`
      SELECT min("occurredAt") AS min FROM "AnalyticsEvent" WHERE ${isSeedVisitorSql}`,
    dbClient.userOrder.findFirst({
      where: seedOrderWhere,
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    dbClient.$queryRaw<{ min: Date | null }[]>`
      SELECT min("day") AS min FROM "AnalyticsDaily"`,
  ]);

  const events = await dbClient.$executeRaw`
    DELETE FROM "AnalyticsEvent" WHERE ${isSeedVisitorSql}`;
  // Items go with their order (ON DELETE CASCADE).
  const { count: orders } = await dbClient.userOrder.deleteMany({
    where: seedOrderWhere,
  });

  if (events === 0 && orders === 0) return { from: null, events, orders };
  return {
    from: minDay(
      eventRange.min && ashgabatDay(eventRange.min),
      firstOrder && ashgabatDay(firstOrder.createdAt),
      dailyRange.min && dailyRange.min.toISOString().slice(0, 10),
    ),
    events,
    orders,
  };
}

const PERIOD_METRICS = [STORED.visitorsWeek, STORED.visitorsMonth];

/**
 * Recomputes the rollups of `from`..`to`: every daily metric, then the week
 * and month uniques of every period touching the range (stored on the
 * period's first day, which may be before `from`). The range's rows are
 * deleted first, so values that no longer exist (views of a seed product)
 * don't linger.
 *
 * `ignoreRetention` is for the seed run, whose raw events older than the
 * retention window exist until the prune that follows. Without it (--clean),
 * days and periods older than the window keep only order-based metrics.
 */
async function rebuildRollups(
  from: string,
  to: string,
  options: { ignoreRetention: boolean },
): Promise<number> {
  const periodsFrom = minDay(weekStart(from), monthStart(from))!;
  await dbClient.$executeRaw`
    DELETE FROM "AnalyticsDaily"
    WHERE ("day" >= ${from}::date AND "day" <= ${to}::date)
       OR ("metric" IN (${Prisma.join(PERIOD_METRICS)})
           AND "day" >= ${periodsFrom}::date AND "day" <= ${to}::date)`;

  await rollupRange(from, to, options);

  // One day per week and month of the range: each call recomputes the week
  // and the month containing it.
  // eslint-disable-next-line no-restricted-syntax
  for (const day of periodDays(from, to)) {
    // eslint-disable-next-line no-await-in-loop
    await rollupPeriodUniques(day, options);
  }

  const [{ count }] = await dbClient.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) AS count FROM "AnalyticsDaily"
    WHERE "day" >= ${periodsFrom}::date AND "day" <= ${to}::date`;
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

async function seed(args: SeedArgs, previousFrom: string | null) {
  const catalog = await loadCatalog();
  console.log(
    `Catalog: ${catalog.products.length} products, ${catalog.categories.length} categories, ${catalog.users.length} users.`,
  );

  const now = new Date();
  const today = ashgabatDay(now);
  const eventCounts = new Map<string, number>();
  const orderCounts = new Map<string, number>();
  let firstDay = today;
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
    if (day < firstDay) firstDay = day;
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
  // data (orders) still supports.
  if (previousFrom && previousFrom < firstDay) {
    console.log(
      `Clearing earlier seed rollups ${previousFrom} .. ${addDays(firstDay, -1)}…`,
    );
    await rebuildRollups(previousFrom, addDays(firstDay, -1), {
      ignoreRetention: false,
    });
  }
  const from = firstDay;
  console.log(`Rolling up ${from} .. ${today}…`);
  const rollupRows = await rebuildRollups(from, today, {
    ignoreRetention: true,
  });

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
    `AnalyticsDaily rows for ${from} .. ${today}: ${fmt(rollupRows)}`,
  );
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
  if (!check.ok) {
    if (!args.force) {
      console.error(`Refusing to run: ${check.reason}`);
      process.exitCode = 1;
      return;
    }
    console.warn(`--force: running against ${check.host} anyway.`);
  } else {
    console.log(`Database host: ${check.host}`);
  }

  const started = Date.now();
  const removed = await removeSeedData();
  if (removed.from) {
    console.log(
      `Removed previous seed data: ${fmt(removed.events)} events, ${fmt(removed.orders)} orders (from ${removed.from}).`,
    );
  }

  if (args.clean) {
    if (removed.from) {
      const today = ashgabatDay(new Date());
      console.log(`Recomputing rollups ${removed.from} .. ${today}…`);
      await rebuildRollups(removed.from, today, { ignoreRetention: false });
    } else {
      console.log('No seed data found.');
    }
  } else {
    await seed(args, removed.from);
  }
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => dbClient.$disconnect());
