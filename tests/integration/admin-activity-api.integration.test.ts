import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { localDay, shiftDay } from '@/lib/adminActivityQueries';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

const ROUTES = {
  staff: '@/pages/api/admin/activity/staff.page',
  feed: '@/pages/api/admin/activity/feed.page',
  heatmap: '@/pages/api/admin/activity/heatmap.page',
} as const;

describe('Admin activity read APIs (integration)', () => {
  let prisma: PrismaClient;
  let superToken: string;
  let superId: string;
  let adminToken: string;
  let adminId: string;
  let busyAdminId: string;
  let idleAdminId: string;
  let deletedAdminId: string;
  const sessionIds: string[] = [];

  const get = async (
    route: keyof typeof ROUTES,
    token: string | null,
    query: Record<string, string> = {},
  ) => {
    const handler = (await import(ROUTES[route])).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/admin/activity',
      query,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    const raw = res._getData() as string;
    return {
      status: res._getStatusCode(),
      body: raw ? JSON.parse(raw) : {},
    };
  };

  const makeAdmin = (name: string, extra: object = {}) =>
    prisma.user.create({
      data: {
        email: `${name}-${Date.now()}-${Math.random()}@test.local`,
        name,
        password: 'placeholder',
        grade: 'ADMIN',
        ...extra,
      },
    });

  const row = (
    userId: string,
    userName: string,
    entity: 'PRODUCT' | 'PRICE' | 'BRAND',
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    createdAt: Date,
  ) => ({
    userId,
    userName,
    entity,
    action,
    targetId: `t-${createdAt.getTime()}`,
    meta: { name: 'x' },
    createdAt,
  });

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    const superuser = await createStaffPrincipal(prisma, 'SUPERUSER');
    superToken = superuser.accessToken;
    superId = superuser.userId;
    const admin = await createStaffPrincipal(prisma, 'ADMIN');
    adminToken = admin.accessToken;
    adminId = admin.userId;

    const now = Date.now();
    busyAdminId = (
      await makeAdmin('ActApi Busy', {
        lastSeenAt: new Date(now - 30_000),
      })
    ).id;
    idleAdminId = (
      await makeAdmin('ActApi Idle', {
        lastSeenAt: new Date(now - 10 * 60_000),
      })
    ).id;
    deletedAdminId = (
      await makeAdmin('ActApi Deleted', { deletedAt: new Date() })
    ).id;
  }, 180_000);

  afterAll(async () => {
    await prisma.adminActivity.deleteMany({
      where: { userName: { startsWith: 'ActApi' } },
    });
    await prisma.chatSession
      .deleteMany({ where: { id: { in: sessionIds } } })
      .catch(() => {});
    await prisma.user
      .deleteMany({
        where: {
          id: {
            in: [superId, adminId, busyAdminId, idleAdminId, deletedAdminId],
          },
        },
      })
      .catch(() => {});
    await prisma.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it.each(['staff', 'feed', 'heatmap'] as const)(
    '%s is 401 without a token and 403 for an ADMIN',
    async (route) => {
      expect((await get(route, null, { userId: 'x' })).status).toBe(401);
      expect((await get(route, adminToken, { userId: 'x' })).status).toBe(403);
    },
  );

  describe('feed', () => {
    const base = new Date('2026-03-10T10:00:00Z');
    const at = (minutes: number) => new Date(base.getTime() + minutes * 60_000);

    beforeAll(async () => {
      await prisma.adminActivity.createMany({
        data: [
          row(busyAdminId, 'ActApi Busy', 'PRODUCT', 'CREATE', at(0)),
          row(busyAdminId, 'ActApi Busy', 'PRICE', 'UPDATE', at(1)),
          row(busyAdminId, 'ActApi Busy', 'PRODUCT', 'UPDATE', at(2)),
          row(idleAdminId, 'ActApi Idle', 'BRAND', 'DELETE', at(3)),
          row(busyAdminId, 'ActApi Busy', 'PRICE', 'UPDATE', at(4)),
        ],
      });
    });

    const ids = (items: { userName: string; entity: string }[]) =>
      items.map((item) => `${item.userName}:${item.entity}`);

    it('lists newest first and filters by admin', async () => {
      const { status, body } = await get('feed', superToken, {
        userId: busyAdminId,
      });
      expect(status).toBe(200);
      expect(body.data.nextCursor).toBeNull();
      expect(ids(body.data.items)).toEqual([
        'ActApi Busy:PRICE',
        'ActApi Busy:PRODUCT',
        'ActApi Busy:PRICE',
        'ActApi Busy:PRODUCT',
      ]);
    });

    it('filters by entity and action', async () => {
      const { body } = await get('feed', superToken, {
        userId: busyAdminId,
        entity: 'PRODUCT',
        action: 'UPDATE',
      });
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].entity).toBe('PRODUCT');
      expect(body.data.items[0].action).toBe('UPDATE');
    });

    it('filters by local day, in Ashgabat time', async () => {
      const inDay = await get('feed', superToken, {
        userId: busyAdminId,
        from: '2026-03-10',
        to: '2026-03-10',
      });
      expect(inDay.body.data.items).toHaveLength(4);

      const dayBefore = await get('feed', superToken, {
        userId: busyAdminId,
        from: '2026-03-09',
        to: '2026-03-09',
      });
      expect(dayBefore.body.data.items).toHaveLength(0);
    });

    it('treats 01:00 local as the next day, not the UTC one', async () => {
      const lateUtc = new Date('2026-03-15T20:00:00Z');
      await prisma.adminActivity.create({
        data: row(idleAdminId, 'ActApi Idle', 'BRAND', 'CREATE', lateUtc),
      });
      const next = await get('feed', superToken, {
        userId: idleAdminId,
        action: 'CREATE',
        from: '2026-03-16',
        to: '2026-03-16',
      });
      expect(next.body.data.items).toHaveLength(1);
      const same = await get('feed', superToken, {
        userId: idleAdminId,
        action: 'CREATE',
        from: '2026-03-15',
        to: '2026-03-15',
      });
      expect(same.body.data.items).toHaveLength(0);
    });

    it('pages with a cursor without skipping or repeating rows', async () => {
      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        // eslint-disable-next-line no-await-in-loop
        const page = await get('feed', superToken, {
          userId: busyAdminId,
          limit: '3',
          ...(cursor ? { cursor } : {}),
        });
        seen.push(
          ...page.body.data.items.map((item: { id: string }) => item.id),
        );
        cursor = page.body.data.nextCursor ?? undefined;
      } while (cursor);
      expect(seen).toHaveLength(4);
      expect(new Set(seen).size).toBe(4);
    });

    it('rejects bad filters with 400', async () => {
      expect((await get('feed', superToken, { entity: 'NOPE' })).status).toBe(
        400,
      );
      expect(
        (
          await get('feed', superToken, {
            from: '2026-03-10',
            to: '2026-03-01',
          })
        ).status,
      ).toBe(400);
    });
  });

  describe('staff', () => {
    beforeAll(async () => {
      const sessionAt = (daysAgo: number) =>
        new Date(Date.now() - daysAgo * 86_400_000);
      const first = await prisma.chatSession.create({
        data: {
          messages: {
            create: [
              {
                senderId: busyAdminId,
                senderRole: 'ADMIN',
                content: 'hi',
                createdAt: sessionAt(2),
              },
              {
                senderId: busyAdminId,
                senderRole: 'ADMIN',
                content: 'again',
                createdAt: sessionAt(1),
              },
            ],
          },
        },
      });
      const second = await prisma.chatSession.create({
        data: {
          messages: {
            create: [
              {
                senderId: busyAdminId,
                senderRole: 'ADMIN',
                content: 'other customer',
                createdAt: sessionAt(1),
              },
            ],
          },
        },
      });
      sessionIds.push(first.id, second.id);
    });

    it('shows ADMIN staff only, with presence, change and chat counts', async () => {
      const { status, body } = await get('staff', superToken);
      expect(status).toBe(200);
      const staff = body.data as {
        id: string;
        online: boolean;
        totalChanges: number;
        customersAnswered: number;
      }[];
      const byId = new Map(staff.map((member) => [member.id, member]));

      expect(byId.has(superId)).toBe(false);
      expect(byId.has(deletedAdminId)).toBe(false);

      expect(byId.get(busyAdminId)).toMatchObject({
        online: true,
        totalChanges: 4,
        customersAnswered: 2,
      });
      expect(byId.get(idleAdminId)).toMatchObject({
        online: false,
        customersAnswered: 0,
      });

      const order = staff.map((member) => member.id);
      expect(order.indexOf(busyAdminId)).toBeLessThan(
        order.indexOf(idleAdminId),
      );
    });
  });

  describe('heatmap', () => {
    it('buckets by Ashgabat day and counts answered customers once per day', async () => {
      const day = shiftDay(localDay(new Date()), -10);
      const utcDay = shiftDay(day, -1);
      // 20:00 UTC is 01:00 the next local day, so it belongs to `day`.
      const lateUtc = new Date(`${utcDay}T20:00:00Z`);
      await prisma.adminActivity.createMany({
        data: [
          row(adminId, 'ActApi Heat', 'PRODUCT', 'CREATE', lateUtc),
          row(
            adminId,
            'ActApi Heat',
            'PRICE',
            'UPDATE',
            new Date(lateUtc.getTime() + 60_000),
          ),
          row(
            adminId,
            'ActApi Heat',
            'PRICE',
            'UPDATE',
            new Date(Date.now() - 400 * 86_400_000),
          ),
        ],
      });
      const session = await prisma.chatSession.create({
        data: {
          messages: {
            create: [
              {
                senderId: adminId,
                senderRole: 'ADMIN',
                content: 'a',
                createdAt: lateUtc,
              },
              {
                senderId: adminId,
                senderRole: 'ADMIN',
                content: 'b',
                createdAt: new Date(lateUtc.getTime() + 60_000),
              },
            ],
          },
        },
      });
      sessionIds.push(session.id);

      const { status, body } = await get('heatmap', superToken, {
        userId: adminId,
      });
      expect(status).toBe(200);
      expect(body.data.to).toBe(localDay(new Date()));
      expect(body.data.days).toEqual([{ date: day, changes: 2, chats: 1 }]);
    });

    it('requires a userId', async () => {
      expect((await get('heatmap', superToken)).status).toBe(400);
    });
  });
});
