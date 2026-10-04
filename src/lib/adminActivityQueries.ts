import dbClient from '@/lib/dbClient';
import {
  AdminActivityAction,
  AdminActivityEntity,
  Prisma,
} from '@prisma/client';

export const ADMIN_TIME_ZONE = 'Asia/Ashgabat';
// Turkmenistan has no DST, so the offset is fixed (the order delivery cut-off
// in pages/lib/orderDelivery.ts relies on the same fact).
const ADMIN_UTC_OFFSET = '+05:00';

/** Three of the ws-server's 30s presence sweeps. */
export const ADMIN_ONLINE_WINDOW_MS = 90_000;

const DEFAULT_FEED_LIMIT = 50;
const MAX_FEED_LIMIT = 100;
const HEATMAP_DAYS = 365;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const isValidDay = (value: string): boolean =>
  DAY_RE.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

export function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Calendar day (YYYY-MM-DD) of an instant, in the shop's time zone. */
export function localDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ADMIN_TIME_ZONE,
  }).format(date);
}

const startOfDay = (day: string) =>
  new Date(`${day}T00:00:00${ADMIN_UTC_OFFSET}`);

/** Local days `from`..`to` inclusive, as a half-open UTC range. */
export function dayRangeUtc(
  from?: string,
  to?: string,
): { gte?: Date; lt?: Date } {
  return {
    ...(from ? { gte: startOfDay(from) } : {}),
    ...(to ? { lt: startOfDay(shiftDay(to, 1)) } : {}),
  };
}

export const isOnline = (lastSeenAt: Date | null, now: Date): boolean =>
  lastSeenAt != null &&
  now.getTime() - lastSeenAt.getTime() <= ADMIN_ONLINE_WINDOW_MS;

export type FeedParams = {
  userId?: string;
  entity?: AdminActivityEntity;
  action?: AdminActivityAction;
  from?: string;
  to?: string;
  limit: number;
  cursor?: string;
};

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export function parseFeedQuery(
  query: Record<string, string | string[] | undefined>,
): { ok: true; value: FeedParams } | { ok: false; message: string } {
  const entity = first(query.entity);
  const action = first(query.action);
  const from = first(query.from);
  const to = first(query.to);
  const userId = first(query.userId);
  const cursor = first(query.cursor);
  const limitRaw = first(query.limit);

  if (
    entity &&
    !(Object.values(AdminActivityEntity) as string[]).includes(entity)
  ) {
    return { ok: false, message: 'Invalid entity' };
  }
  if (
    action &&
    !(Object.values(AdminActivityAction) as string[]).includes(action)
  ) {
    return { ok: false, message: 'Invalid action' };
  }
  if ((from && !isValidDay(from)) || (to && !isValidDay(to))) {
    return { ok: false, message: 'Dates must be YYYY-MM-DD' };
  }
  if (from && to && from > to) {
    return { ok: false, message: 'from must not be after to' };
  }

  let limit = DEFAULT_FEED_LIMIT;
  if (limitRaw !== undefined) {
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return { ok: false, message: 'Invalid limit' };
    }
    limit = Math.min(parsed, MAX_FEED_LIMIT);
  }

  return {
    ok: true,
    value: {
      ...(userId ? { userId } : {}),
      ...(entity ? { entity: entity as AdminActivityEntity } : {}),
      ...(action ? { action: action as AdminActivityAction } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      limit,
      ...(cursor ? { cursor } : {}),
    },
  };
}

export async function getActivityFeed(params: FeedParams) {
  const range = dayRangeUtc(params.from, params.to);
  const where: Prisma.AdminActivityWhereInput = {
    ...(params.userId ? { userId: params.userId } : {}),
    ...(params.entity ? { entity: params.entity } : {}),
    ...(params.action ? { action: params.action } : {}),
    ...(range.gte || range.lt ? { createdAt: range } : {}),
  };

  const rows = await dbClient.adminActivity.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: params.limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > params.limit;
  const items = hasMore ? rows.slice(0, params.limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

export async function getStaffOverview(now: Date = new Date()) {
  const admins = await dbClient.user.findMany({
    where: { grade: 'ADMIN', deletedAt: null },
    select: { id: true, name: true, lastSeenAt: true },
  });
  if (admins.length === 0) return [];
  const ids = admins.map((admin) => admin.id);

  const [changeCounts, chatCounts] = await Promise.all([
    dbClient.adminActivity.groupBy({
      by: ['userId'],
      where: { userId: { in: ids } },
      _count: true,
    }),
    dbClient.$queryRaw<{ senderId: string; answered: number }[]>(
      Prisma.sql`
        SELECT "senderId", COUNT(DISTINCT "sessionId")::int AS answered
        FROM "ChatMessage"
        WHERE "senderId" IN (${Prisma.join(ids)})
        GROUP BY "senderId"`,
    ),
  ]);
  const changesById = new Map(
    changeCounts.map((row) => [
      row.userId,
      // _count is Prisma's own groupBy result shape, not our naming.
      // eslint-disable-next-line no-underscore-dangle
      row._count,
    ]),
  );
  const answeredById = new Map(
    chatCounts.map((row) => [row.senderId, row.answered]),
  );

  return admins
    .map((admin) => ({
      id: admin.id,
      name: admin.name,
      lastSeenAt: admin.lastSeenAt,
      online: isOnline(admin.lastSeenAt, now),
      totalChanges: changesById.get(admin.id) ?? 0,
      customersAnswered: answeredById.get(admin.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        Number(b.online) - Number(a.online) ||
        (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0) ||
        a.name.localeCompare(b.name),
    );
}

export type HeatmapDay = { date: string; changes: number; chats: number };

/**
 * Per-day activity for one admin over the last year, bucketed by local day in
 * SQL. Only days with activity are returned. `chats` counts the customers the
 * admin answered that day, from the chat history itself.
 */
export async function getHeatmap(
  userId: string,
  now: Date = new Date(),
): Promise<{ from: string; to: string; days: HeatmapDay[] }> {
  const to = localDay(now);
  const from = shiftDay(to, -(HEATMAP_DAYS - 1));
  const since = startOfDay(from);

  const [changeDays, chatDays] = await Promise.all([
    dbClient.$queryRaw<{ day: string; n: number }[]>(Prisma.sql`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${ADMIN_TIME_ZONE}, 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS n
      FROM "AdminActivity"
      WHERE "userId" = ${userId} AND "createdAt" >= ${since}
      GROUP BY 1`),
    dbClient.$queryRaw<{ day: string; n: number }[]>(Prisma.sql`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${ADMIN_TIME_ZONE}, 'YYYY-MM-DD') AS day,
             COUNT(DISTINCT "sessionId")::int AS n
      FROM "ChatMessage"
      WHERE "senderId" = ${userId} AND "createdAt" >= ${since}
      GROUP BY 1`),
  ]);

  const byDay = new Map<string, HeatmapDay>();
  const entry = (date: string) => {
    if (!byDay.has(date)) byDay.set(date, { date, changes: 0, chats: 0 });
    return byDay.get(date)!;
  };
  changeDays.forEach(({ day, n }) => {
    entry(day).changes = n;
  });
  chatDays.forEach(({ day, n }) => {
    entry(day).chats = n;
  });

  return {
    from,
    to,
    days: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
