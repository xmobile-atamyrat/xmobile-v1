import type { NextApiRequest, NextApiResponse } from 'next';
import { NotificationType, PrismaClient } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Notifications API (integration)', () => {
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

  it('GET /api/notifications returns empty list for new user', async () => {
    const session = await signupTestUser('notif-list');
    const handler = (await import('@/pages/api/notifications/index.page'))
      .default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/notifications',
      headers: { authorization: `Bearer ${session.accessToken}` },
      query: {},
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const json = JSON.parse(res._getData() as string);
    expect(json.data.notifications.length).toBe(0);
    expect(json.data.nextCursor).toBeUndefined();
  });

  it('GET /api/notifications/count returns zero unread', async () => {
    const session = await signupTestUser('notif-count');
    const handler = (await import('@/pages/api/notifications/count.page'))
      .default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/notifications/count',
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData() as string).data.count).toBe(0);
  });

  it('POST /api/notifications/mark-read returns 400 without identifiers', async () => {
    const session = await signupTestUser('notif-mark');
    const handler = (await import('@/pages/api/notifications/mark-read.page'))
      .default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/notifications/mark-read',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: {},
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(400);
  });

  it('marks a seeded notification as read and count drops', async () => {
    const session = await signupTestUser('notif-flow');
    const notif = await prisma.inAppNotification.create({
      data: {
        userId: session.userId,
        type: NotificationType.ORDER_STATUS_UPDATE,
        title: 'Test',
        content: 'Hello',
        isRead: false,
      },
    });

    const countBefore = (await import('@/pages/api/notifications/count.page'))
      .default;
    const c1 = createMocks({
      method: 'GET',
      url: '/api/notifications/count',
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    await countBefore(
      c1.req as unknown as NextApiRequest,
      c1.res as unknown as NextApiResponse,
    );
    expect(JSON.parse(c1.res._getData() as string).data.count).toBe(1);

    const markRead = (await import('@/pages/api/notifications/mark-read.page'))
      .default;
    const mark = createMocks({
      method: 'POST',
      url: '/api/notifications/mark-read',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: { notificationId: notif.id },
    });
    await markRead(
      mark.req as unknown as NextApiRequest,
      mark.res as unknown as NextApiResponse,
    );
    expect(mark.res._getStatusCode()).toBe(200);
    expect(JSON.parse(mark.res._getData() as string).data.updated).toBe(1);

    const c2 = createMocks({
      method: 'GET',
      url: '/api/notifications/count',
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    await countBefore(
      c2.req as unknown as NextApiRequest,
      c2.res as unknown as NextApiResponse,
    );
    expect(JSON.parse(c2.res._getData() as string).data.count).toBe(0);

    await prisma.inAppNotification.delete({ where: { id: notif.id } });
  });

  it('retry worker never marks a read notification as failed, even aged past the window', async () => {
    const session = await signupTestUser('notif-retry-read');
    const withToken = await signupTestUser('notif-retry-token');
    await prisma.fCMToken.create({
      data: {
        userId: withToken.userId,
        token: `test-token-${withToken.userId}`,
        deviceInfo: `test-device-${withToken.userId}`,
      },
    });
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000); // past the 24h window

    // Read + PENDING + aged: the user saw it, so it must NOT be "permanently failed".
    const read = await prisma.inAppNotification.create({
      data: {
        userId: session.userId,
        type: NotificationType.ORDER_STATUS_UPDATE,
        title: 'Read',
        content: 'seen by user',
        isRead: true,
        deliveryStatus: 'PENDING',
        createdAt: old,
      },
    });
    // Unread + PENDING + aged, user has no FCM tokens: expires quietly —
    // FAILED with the non-alertable "no FCM tokens" classification.
    const unread = await prisma.inAppNotification.create({
      data: {
        userId: session.userId,
        type: NotificationType.ORDER_STATUS_UPDATE,
        title: 'Unread',
        content: 'never delivered',
        isRead: false,
        deliveryStatus: 'PENDING',
        createdAt: old,
      },
    });
    // Unread + PENDING + aged, user HAS a token: a genuine push failure,
    // the alertable "retry window expired" case.
    const unreadWithToken = await prisma.inAppNotification.create({
      data: {
        userId: withToken.userId,
        type: NotificationType.ORDER_STATUS_UPDATE,
        title: 'Unread with token',
        content: 'never delivered despite token',
        isRead: false,
        deliveryStatus: 'PENDING',
        createdAt: old,
      },
    });

    const { runNotificationRetryInner } = await import(
      '../../scripts/batch-runner/jobs/notification-retry'
    );
    await runNotificationRetryInner();

    const readAfter = await prisma.inAppNotification.findUnique({
      where: { id: read.id },
    });
    const unreadAfter = await prisma.inAppNotification.findUnique({
      where: { id: unread.id },
    });
    const unreadWithTokenAfter = await prisma.inAppNotification.findUnique({
      where: { id: unreadWithToken.id },
    });

    expect(readAfter?.deliveryStatus).toBe('SENT');
    expect(unreadAfter?.deliveryStatus).toBe('FAILED');
    expect(unreadAfter?.lastError).toBe('no FCM tokens');
    expect(unreadWithTokenAfter?.deliveryStatus).toBe('FAILED');
    expect(unreadWithTokenAfter?.lastError).toBe('retry window expired');

    await prisma.inAppNotification.deleteMany({
      where: { id: { in: [read.id, unread.id, unreadWithToken.id] } },
    });
  });
});
