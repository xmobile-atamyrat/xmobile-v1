import { randomUUID } from 'node:crypto';

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

// Must match the password used by signupTestUser so we can re-authenticate.
const TEST_PASSWORD = 'Secret1!x';
const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_DAYS = 90;

function getSetCookie(res: {
  getHeader: (name: string) => string | string[] | number | undefined;
}): string {
  const h = res.getHeader('Set-Cookie');
  return Array.isArray(h) ? h.join(';') : String(h ?? '');
}

/** An analytics event naming `userId`; returns its id. */
async function analyticsEventFor(
  prisma: PrismaClient,
  userId: string,
): Promise<bigint> {
  const row = await prisma.analyticsEvent.create({
    data: {
      name: 'page_view',
      visitorId: randomUUID(),
      userId,
      platform: 'WEB',
      locale: 'ru',
      props: { path: '/' },
    },
  });
  return row.id;
}

/** Force a user's deletedAt to a specific point in the past (or null). */
async function setDeletedAt(
  prisma: PrismaClient,
  userId: string,
  daysAgo: number | null,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      deletedAt:
        daysAgo == null ? null : new Date(Date.now() - daysAgo * DAY_MS),
    },
  });
}

describe('Soft-delete user lifecycle (integration)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/user — soft delete the current account
  // ---------------------------------------------------------------------------
  describe('DELETE /api/user (soft delete)', () => {
    it('soft-deletes the account: 200, sets deletedAt, clears refresh cookie', async () => {
      const session = await signupTestUser('sd-delete');
      const handler = (await import('@/pages/api/user/index.page')).default;

      const { req, res } = createMocks({
        method: 'DELETE',
        url: '/api/user',
        headers: { authorization: `Bearer ${session.accessToken}` },
      });
      await handler(
        req as unknown as NextApiRequest,
        res as unknown as NextApiResponse,
      );

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData() as string).success).toBe(true);

      // Refresh cookie is expired immediately (Max-Age=0).
      const cookie = getSetCookie(res);
      expect(cookie).toContain('REFRESH_TOKEN=');
      expect(cookie).toContain('Max-Age=0');

      // Row still exists but is now soft-deleted.
      const row = await prisma.user.findUnique({
        where: { id: session.userId },
      });
      expect(row).not.toBeNull();
      expect(row?.deletedAt).not.toBeNull();
    });

    it('returns 401 when Authorization header is missing', async () => {
      const handler = (await import('@/pages/api/user/index.page')).default;
      const { req, res } = createMocks({ method: 'DELETE', url: '/api/user' });
      await handler(
        req as unknown as NextApiRequest,
        res as unknown as NextApiResponse,
      );
      expect(res._getStatusCode()).toBe(401);
    });

    it('returns 401 (not 500) for a malformed bearer token', async () => {
      const handler = (await import('@/pages/api/user/index.page')).default;
      const { req, res } = createMocks({
        method: 'DELETE',
        url: '/api/user',
        headers: { authorization: 'Bearer not-a-real-jwt' },
      });
      await handler(
        req as unknown as NextApiRequest,
        res as unknown as NextApiResponse,
      );
      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData() as string).message).toBe('Unauthorized');
    });

    it('returns 404 accountAlreadyDeleted when the account is already soft-deleted', async () => {
      const session = await signupTestUser('sd-twice');
      const handler = (await import('@/pages/api/user/index.page')).default;

      const first = createMocks({
        method: 'DELETE',
        url: '/api/user',
        headers: { authorization: `Bearer ${session.accessToken}` },
      });
      await handler(
        first.req as unknown as NextApiRequest,
        first.res as unknown as NextApiResponse,
      );
      expect(first.res._getStatusCode()).toBe(200);

      const second = createMocks({
        method: 'DELETE',
        url: '/api/user',
        headers: { authorization: `Bearer ${session.accessToken}` },
      });
      await handler(
        second.req as unknown as NextApiRequest,
        second.res as unknown as NextApiResponse,
      );
      expect(second.res._getStatusCode()).toBe(404);
      expect(JSON.parse(second.res._getData() as string).message).toBe(
        'accountAlreadyDeleted',
      );
    });

    it('returns 404 userNotFound when the user row no longer exists', async () => {
      const session = await signupTestUser('sd-gone');
      const handler = (await import('@/pages/api/user/index.page')).default;

      // Hard-delete the row out from under a still-valid access token.
      await prisma.user.delete({ where: { id: session.userId } });

      const { req, res } = createMocks({
        method: 'DELETE',
        url: '/api/user',
        headers: { authorization: `Bearer ${session.accessToken}` },
      });
      await handler(
        req as unknown as NextApiRequest,
        res as unknown as NextApiResponse,
      );
      expect(res._getStatusCode()).toBe(404);
      expect(JSON.parse(res._getData() as string).message).toBe('userNotFound');
    });

    it('returns 405 for unsupported methods', async () => {
      const handler = (await import('@/pages/api/user/index.page')).default;
      const { req, res } = createMocks({ method: 'PUT', url: '/api/user' });
      await handler(
        req as unknown as NextApiRequest,
        res as unknown as NextApiResponse,
      );
      expect(res._getStatusCode()).toBe(405);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/user — session refresh must reject a soft-deleted account
  // ---------------------------------------------------------------------------
  describe('GET /api/user (session refresh)', () => {
    it('returns 401 when the account is soft-deleted', async () => {
      const session = await signupTestUser('sd-refresh');
      await setDeletedAt(prisma, session.userId, 1);

      const handler = (await import('@/pages/api/user/index.page')).default;
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/user',
        cookies: { REFRESH_TOKEN: session.refreshToken },
      });
      await handler(
        req as unknown as NextApiRequest,
        res as unknown as NextApiResponse,
      );
      expect(res._getStatusCode()).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/user/signin — restore vs. permanent deletion at the grace boundary
  // ---------------------------------------------------------------------------
  describe('POST /api/user/signin (restore / permanent delete)', () => {
    it('restores a soft-deleted account when signing in within the grace period', async () => {
      const session = await signupTestUser('sd-restore');
      await setDeletedAt(prisma, session.userId, GRACE_DAYS - 1); // 89 days ago

      const signin = (await import('@/pages/api/user/signin.page')).default;
      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/user/signin',
        body: { email: session.email, password: TEST_PASSWORD },
      });
      await signin(
        req as unknown as NextApiRequest,
        res as unknown as NextApiResponse,
      );

      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData() as string);
      expect(json.success).toBe(true);
      expect(json.data.accessToken).toBeTruthy();
      expect(getSetCookie(res)).toContain('REFRESH_TOKEN=');

      // deletedAt has been cleared — account is active again.
      const row = await prisma.user.findUnique({
        where: { id: session.userId },
      });
      expect(row?.deletedAt).toBeNull();
    });

    it('permanently deletes the row and returns accountPermanentlyDeleted past the grace period', async () => {
      const session = await signupTestUser('sd-expire');
      await setDeletedAt(prisma, session.userId, GRACE_DAYS + 1); // 91 days ago

      const signin = (await import('@/pages/api/user/signin.page')).default;
      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/user/signin',
        body: { email: session.email, password: TEST_PASSWORD },
      });
      await signin(
        req as unknown as NextApiRequest,
        res as unknown as NextApiResponse,
      );

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData() as string).message).toBe(
        'accountPermanentlyDeleted',
      );

      // Row is gone for good.
      const row = await prisma.user.findUnique({
        where: { id: session.userId },
      });
      expect(row).toBeNull();
    });

    it('keeps the analytics events of a permanently deleted account, without the user', async () => {
      const session = await signupTestUser('sd-expire-analytics');
      const eventId = await analyticsEventFor(prisma, session.userId);
      await setDeletedAt(prisma, session.userId, GRACE_DAYS + 1);

      const signin = (await import('@/pages/api/user/signin.page')).default;
      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/user/signin',
        body: { email: session.email, password: TEST_PASSWORD },
      });
      await signin(
        req as unknown as NextApiRequest,
        res as unknown as NextApiResponse,
      );

      expect(JSON.parse(res._getData() as string).message).toBe(
        'accountPermanentlyDeleted',
      );
      const event = await prisma.analyticsEvent.findUnique({
        where: { id: eventId },
      });
      expect(event).not.toBeNull();
      expect(event?.userId).toBeNull();
    });

    it('rejects wrong password before touching a soft-deleted account', async () => {
      const session = await signupTestUser('sd-wrongpw');
      await setDeletedAt(prisma, session.userId, GRACE_DAYS + 5);

      const signin = (await import('@/pages/api/user/signin.page')).default;
      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/user/signin',
        body: { email: session.email, password: 'WrongPass1!' },
      });
      await signin(
        req as unknown as NextApiRequest,
        res as unknown as NextApiResponse,
      );

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData() as string).message).toBe(
        'passwordIncorrect',
      );

      // Account must NOT have been purged by a failed login.
      const row = await prisma.user.findUnique({
        where: { id: session.userId },
      });
      expect(row).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Batch job — automatic purge of expired soft-deleted accounts
  // ---------------------------------------------------------------------------
  describe('account-deletion batch job', () => {
    it('purges accounts past the grace period, keeps recent and active ones', async () => {
      const expired = await signupTestUser('sd-job-expired');
      const recent = await signupTestUser('sd-job-recent');
      const active = await signupTestUser('sd-job-active');

      await setDeletedAt(prisma, expired.userId, GRACE_DAYS + 2); // purge
      await setDeletedAt(prisma, recent.userId, GRACE_DAYS - 2); // keep (in grace)
      await setDeletedAt(prisma, active.userId, null); // keep (active)

      const { accountDeletionJob } = await import(
        '../../scripts/batch-runner/jobs/account-deletion'
      );
      await accountDeletionJob.run();

      const expiredRow = await prisma.user.findUnique({
        where: { id: expired.userId },
      });
      const recentRow = await prisma.user.findUnique({
        where: { id: recent.userId },
      });
      const activeRow = await prisma.user.findUnique({
        where: { id: active.userId },
      });

      expect(expiredRow).toBeNull();
      expect(recentRow).not.toBeNull();
      expect(recentRow?.deletedAt).not.toBeNull();
      expect(activeRow).not.toBeNull();
      expect(activeRow?.deletedAt).toBeNull();
    });

    it('detaches analytics events from purged accounts only', async () => {
      const expired = await signupTestUser('sd-job-analytics-expired');
      const recent = await signupTestUser('sd-job-analytics-recent');
      const expiredEvent = await analyticsEventFor(prisma, expired.userId);
      const recentEvent = await analyticsEventFor(prisma, recent.userId);
      await setDeletedAt(prisma, expired.userId, GRACE_DAYS + 2);
      await setDeletedAt(prisma, recent.userId, GRACE_DAYS - 2);

      const { accountDeletionJob } = await import(
        '../../scripts/batch-runner/jobs/account-deletion'
      );
      await accountDeletionJob.run();

      const events = await prisma.analyticsEvent.findMany({
        where: { id: { in: [expiredEvent, recentEvent] } },
        orderBy: { id: 'asc' },
      });
      expect(events.map((e) => e.userId)).toEqual([null, recent.userId]);
      expect(
        await prisma.user.findUnique({ where: { id: expired.userId } }),
      ).toBeNull();
    });

    it('is configured as a daily cron job', async () => {
      const { accountDeletionJob } = await import(
        '../../scripts/batch-runner/jobs/account-deletion'
      );
      expect(accountDeletionJob.id).toBe('account-deletion');
      expect(accountDeletionJob.schedule).toEqual({
        type: 'cron',
        expr: '0 3 * * *',
      });
    });
  });
});
