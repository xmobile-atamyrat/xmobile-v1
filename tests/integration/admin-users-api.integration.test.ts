import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, UserRole } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

const ROUTE = '@/pages/api/admin/users.page';

describe('Admin users API (integration)', () => {
  let prisma: PrismaClient;
  let superToken: string;
  let superId: string;
  let adminToken: string;
  let adminId: string;
  const userIds: string[] = [];

  const call = async (
    method: 'GET' | 'PATCH',
    token: string | null,
    {
      query = {},
      body,
    }: { query?: Record<string, string>; body?: object } = {},
  ) => {
    const handler = (await import(ROUTE)).default;
    const { req, res } = createMocks({
      method,
      url: '/api/admin/users',
      query,
      body,
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

  const makeUser = async (name: string, extra: object = {}) => {
    const user = await prisma.user.create({
      data: {
        email: `${name.replace(/\s/g, '-')}-${Date.now()}-${Math.random()}@test.local`,
        name,
        password: 'placeholder',
        ...extra,
      },
    });
    userIds.push(user.id);
    return user;
  };

  const tokenFor = async (userId: string, grade: UserRole) => {
    const { generateTokens } = await import('@/pages/api/utils/tokenUtils');
    return generateTokens(userId, grade).accessToken;
  };

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
  }, 180_000);

  afterAll(async () => {
    await prisma.user
      .deleteMany({ where: { id: { in: [superId, adminId, ...userIds] } } })
      .catch(() => {});
    await prisma.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('is 401 without a token and 403 for an ADMIN', async () => {
    expect((await call('GET', null)).status).toBe(401);
    expect((await call('GET', adminToken)).status).toBe(403);
    expect(
      (
        await call('PATCH', adminToken, {
          body: { userId: superId, grade: 'FREE' },
        })
      ).status,
    ).toBe(403);
  });

  it('lists everyone, staff first, and searches case-insensitively', async () => {
    const customer = await makeUser('RoleApi Customer', {
      phoneNumber: '+99365111222',
    });
    const gone = await makeUser('RoleApi Gone', { deletedAt: new Date() });

    // Page through everything: the default view has no role filter.
    const all: { id: string; grade: UserRole }[] = [];
    let cursor: string | null = null;
    do {
      const page = await call('GET', superToken, {
        query: cursor ? { cursor } : {},
      });
      expect(page.status).toBe(200);
      expect(page.body.data.items[0]).not.toHaveProperty('password');
      all.push(...page.body.data.items);
      cursor = page.body.data.nextCursor;
    } while (cursor);
    const ids = all.map((u) => u.id);
    expect(ids).toEqual(
      expect.arrayContaining([superId, adminId, customer.id]),
    );
    expect(ids).not.toContain(gone.id);
    expect(new Set(ids).size).toBe(ids.length);
    const rank = { SUPERUSER: 0, ADMIN: 1, FREE: 2 } as const;
    const ranks = all.map((u) => rank[u.grade]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));

    const byName = await call('GET', superToken, { query: { q: 'ROLEAPI' } });
    expect(byName.body.data.items.map((u: { id: string }) => u.id)).toEqual([
      customer.id,
    ]);

    const byEmail = await call('GET', superToken, {
      query: { q: customer.email.toUpperCase() },
    });
    expect(byEmail.body.data.items.map((u: { id: string }) => u.id)).toEqual([
      customer.id,
    ]);

    const byPhone = await call('GET', superToken, {
      query: { q: '65111222' },
    });
    expect(byPhone.body.data.items.map((u: { id: string }) => u.id)).toEqual([
      customer.id,
    ]);

    expect(
      (await call('GET', superToken, { query: { q: 'x'.repeat(101) } })).status,
    ).toBe(400);
  });

  it('promotes and demotes another account', async () => {
    const target = await makeUser('RoleApi Target');

    const promote = await call('PATCH', superToken, {
      body: { userId: target.id, grade: 'SUPERUSER' },
    });
    expect(promote.status).toBe(200);
    expect(promote.body.data).toEqual({ id: target.id, grade: 'SUPERUSER' });

    const demote = await call('PATCH', superToken, {
      body: { userId: target.id, grade: 'FREE' },
    });
    expect(demote.status).toBe(200);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).grade,
    ).toBe('FREE');
  });

  it("refuses to change the caller's own role", async () => {
    const response = await call('PATCH', superToken, {
      body: { userId: superId, grade: 'FREE' },
    });
    expect(response.status).toBe(400);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: superId } })).grade,
    ).toBe('SUPERUSER');
  });

  it('404s a deleted account and 400s a bad body', async () => {
    const gone = await makeUser('RoleApi Deleted', { deletedAt: new Date() });
    expect(
      (
        await call('PATCH', superToken, {
          body: { userId: gone.id, grade: 'ADMIN' },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call('PATCH', superToken, {
          body: { userId: gone.id, grade: 'OWNER' },
        })
      ).status,
    ).toBe(400);
  });

  it('locks a demoted superuser out without waiting for their token to expire', async () => {
    const other = await makeUser('RoleApi Other Super', {
      grade: 'SUPERUSER',
    });
    const otherToken = await tokenFor(other.id, 'SUPERUSER');
    expect((await call('GET', otherToken)).status).toBe(200);

    await call('PATCH', superToken, {
      body: { userId: other.id, grade: 'ADMIN' },
    });

    expect((await call('GET', otherToken)).status).toBe(403);
  });
});
