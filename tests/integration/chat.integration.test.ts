import { NotificationType, PrismaClient, UserRole } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { sendFCMWithCallbackFallback } from '@/lib/fcm/fcmService';
import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { signupTestUser } from './shared/signup-test-user';
import { createStaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Chat API (integration)', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('FREE user lists empty sessions then creates one (201)', async () => {
    const free = await signupTestUser('chat-free');
    const handler = (await import('@/pages/api/chat/session.page')).default;
    const auth = { authorization: `Bearer ${free.accessToken}` };

    const list = createMocks({
      method: 'GET',
      url: '/api/chat/session',
      headers: auth,
    });
    await handler(
      list.req as unknown as NextApiRequest,
      list.res as unknown as NextApiResponse,
    );
    expect(list.res._getStatusCode()).toBe(200);
    expect(JSON.parse(list.res._getData() as string).data.length).toBe(0);

    const post = createMocks({
      method: 'POST',
      url: '/api/chat/session',
      headers: auth,
    });
    await handler(
      post.req as unknown as NextApiRequest,
      post.res as unknown as NextApiResponse,
    );
    expect(post.res._getStatusCode()).toBe(201);
    const sessionId = JSON.parse(post.res._getData() as string).data.id;

    await prisma.chatSession.delete({ where: { id: sessionId } });
  });

  it('FREE user cannot create a second active session (409)', async () => {
    const free = await signupTestUser('chat-dup');
    const handler = (await import('@/pages/api/chat/session.page')).default;
    const auth = { authorization: `Bearer ${free.accessToken}` };

    const first = createMocks({
      method: 'POST',
      url: '/api/chat/session',
      headers: auth,
    });
    await handler(
      first.req as unknown as NextApiRequest,
      first.res as unknown as NextApiResponse,
    );
    const sessionId = JSON.parse(first.res._getData() as string).data.id;

    const second = createMocks({
      method: 'POST',
      url: '/api/chat/session',
      headers: auth,
    });
    await handler(
      second.req as unknown as NextApiRequest,
      second.res as unknown as NextApiResponse,
    );
    expect(second.res._getStatusCode()).toBe(409);

    await prisma.chatSession.delete({ where: { id: sessionId } });
  });

  it('FREE session creation creates staff notifications and triggers FCM callback', async () => {
    const free = await signupTestUser('chat-notify');
    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    const superuser = await createStaffPrincipal(prisma, UserRole.SUPERUSER);
    const handler = (await import('@/pages/api/chat/session.page')).default;

    const post = createMocks({
      method: 'POST',
      url: '/api/chat/session',
      headers: { authorization: `Bearer ${free.accessToken}` },
    });
    await handler(
      post.req as unknown as NextApiRequest,
      post.res as unknown as NextApiResponse,
    );
    expect(post.res._getStatusCode()).toBe(201);
    const sessionId = JSON.parse(post.res._getData() as string).data.id;

    const notifications = await prisma.inAppNotification.findMany({
      where: { sessionId },
      orderBy: { userId: 'asc' },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(2);
    const notificationByUserId = new Map(
      notifications.map((notification) => [notification.userId, notification]),
    );
    expect(notificationByUserId.has(admin.userId)).toBe(true);
    expect(notificationByUserId.has(superuser.userId)).toBe(true);
    expect(notificationByUserId.get(admin.userId)?.type).toBe(
      NotificationType.CHAT_MESSAGE,
    );
    expect(notificationByUserId.get(superuser.userId)?.type).toBe(
      NotificationType.CHAT_MESSAGE,
    );
    expect(notificationByUserId.get(admin.userId)?.isRead).toBe(false);
    expect(notificationByUserId.get(superuser.userId)?.isRead).toBe(false);

    const sendFCMMock = vi.mocked(sendFCMWithCallbackFallback);
    expect(sendFCMMock).toHaveBeenCalledTimes(notifications.length);

    const notifiedUserIds = new Set(
      sendFCMMock.mock.calls.map(([userId]) => userId as string),
    );
    expect(notifiedUserIds.has(admin.userId)).toBe(true);
    expect(notifiedUserIds.has(superuser.userId)).toBe(true);

    const notifiedIdsFromCalls = new Set(
      sendFCMMock.mock.calls.map(([, notification]) => notification.id),
    );
    expect(notifiedIdsFromCalls).toEqual(
      new Set(notifications.map((notification) => notification.id)),
    );

    await prisma.chatSession.delete({ where: { id: sessionId } });
    await prisma.user.delete({ where: { id: admin.userId } });
    await prisma.user.delete({ where: { id: superuser.userId } });
  });

  it.skip('ADMIN joins PENDING session via sessionActions', async () => {
    const free = await signupTestUser('chat-join');
    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    const sessionHandler = (await import('@/pages/api/chat/session.page'))
      .default;
    const actions = (await import('@/pages/api/chat/sessionActions.page'))
      .default;

    const post = createMocks({
      method: 'POST',
      url: '/api/chat/session',
      headers: { authorization: `Bearer ${free.accessToken}` },
    });
    await sessionHandler(
      post.req as unknown as NextApiRequest,
      post.res as unknown as NextApiResponse,
    );
    const sessionId = JSON.parse(post.res._getData() as string).data.id;

    const join = createMocks({
      method: 'POST',
      url: '/api/chat/sessionActions',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      body: { sessionId },
    });
    await actions(
      join.req as unknown as NextApiRequest,
      join.res as unknown as NextApiResponse,
    );
    expect(join.res._getStatusCode()).toBe(200);

    await prisma.chatSession.delete({ where: { id: sessionId } });
    await prisma.user.delete({ where: { id: admin.userId } });
  });

  it('PATCH /api/chat/session updates status idempotently and enforces ownership', async () => {
    const free = await signupTestUser('chat-patch-owner');
    const otherFree = await signupTestUser('chat-patch-attacker');
    const handler = (await import('@/pages/api/chat/session.page')).default;

    // 1. Create a session for the owner
    const post = createMocks({
      method: 'POST',
      url: '/api/chat/session',
      headers: { authorization: `Bearer ${free.accessToken}` },
    });
    await handler(
      post.req as unknown as NextApiRequest,
      post.res as unknown as NextApiResponse,
    );
    const sessionId = JSON.parse(post.res._getData() as string).data.id;

    // 2. Attempt to update session status by a different user (should be 403 Forbidden)
    const unauthorizedPatch = createMocks({
      method: 'PATCH',
      url: '/api/chat/session',
      headers: { authorization: `Bearer ${otherFree.accessToken}` },
      body: { chatStatus: 'CLOSED', sessionId },
    });
    await handler(
      unauthorizedPatch.req as unknown as NextApiRequest,
      unauthorizedPatch.res as unknown as NextApiResponse,
    );
    expect(unauthorizedPatch.res._getStatusCode()).toBe(403);

    // 3. Correct user updates status to CLOSED (should be 200 OK)
    const close = createMocks({
      method: 'PATCH',
      url: '/api/chat/session',
      headers: { authorization: `Bearer ${free.accessToken}` },
      body: { chatStatus: 'CLOSED', sessionId },
    });
    await handler(
      close.req as unknown as NextApiRequest,
      close.res as unknown as NextApiResponse,
    );
    expect(close.res._getStatusCode()).toBe(200);
    expect(JSON.parse(close.res._getData() as string).data.status).toBe(
      'CLOSED',
    );

    // 4. Send the same status update again (should be 200 OK - Idempotency)
    const again = createMocks({
      method: 'PATCH',
      url: '/api/chat/session',
      headers: { authorization: `Bearer ${free.accessToken}` },
      body: { chatStatus: 'CLOSED', sessionId },
    });
    await handler(
      again.req as unknown as NextApiRequest,
      again.res as unknown as NextApiResponse,
    );
    expect(again.res._getStatusCode()).toBe(200);
    expect(JSON.parse(again.res._getData() as string).data.status).toBe(
      'CLOSED',
    );

    await prisma.chatSession.delete({ where: { id: sessionId } });
  });

  it('PATCH /api/chat/session allows ADMIN to close any session', async () => {
    const free = await signupTestUser('chat-admin-close-owner');
    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    const handler = (await import('@/pages/api/chat/session.page')).default;

    // 1. Create a session for the FREE user
    const post = createMocks({
      method: 'POST',
      url: '/api/chat/session',
      headers: { authorization: `Bearer ${free.accessToken}` },
    });
    await handler(
      post.req as unknown as NextApiRequest,
      post.res as unknown as NextApiResponse,
    );
    const sessionId = JSON.parse(post.res._getData() as string).data.id;

    // 2. Admin (who is NOT a participant) closes the session
    const adminClose = createMocks({
      method: 'PATCH',
      url: '/api/chat/session',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      body: { chatStatus: 'CLOSED', sessionId },
    });
    await handler(
      adminClose.req as unknown as NextApiRequest,
      adminClose.res as unknown as NextApiResponse,
    );
    expect(adminClose.res._getStatusCode()).toBe(200);
    expect(JSON.parse(adminClose.res._getData() as string).data.status).toBe(
      'CLOSED',
    );

    await prisma.chatSession.delete({ where: { id: sessionId } });
    await prisma.user.delete({ where: { id: admin.userId } });
  });

  it('PATCH /api/chat/session returns 404 for non-existent session', async () => {
    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    const handler = (await import('@/pages/api/chat/session.page')).default;

    const ghostPatch = createMocks({
      method: 'PATCH',
      url: '/api/chat/session',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      body: {
        chatStatus: 'CLOSED',
        sessionId: '00000000-0000-4000-8000-000000000000',
      },
    });
    await handler(
      ghostPatch.req as unknown as NextApiRequest,
      ghostPatch.res as unknown as NextApiResponse,
    );
    expect(ghostPatch.res._getStatusCode()).toBe(404);

    await prisma.user.delete({ where: { id: admin.userId } });
  });

  it('PATCH /api/chat/session blocks reopening a CLOSED session', async () => {
    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    const handler = (await import('@/pages/api/chat/session.page')).default;

    // 1. Create a session that is already CLOSED
    const session = await prisma.chatSession.create({
      data: {
        status: 'CLOSED',
        users: {
          create: {
            name: 'Reopen Test',
            email: 'reopen@test.com',
            password: 'dummy-password',
          },
        },
      },
    });

    // 2. Attempt to change status from CLOSED to ACTIVE
    const reopen = createMocks({
      method: 'PATCH',
      url: '/api/chat/session',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      body: { chatStatus: 'ACTIVE', sessionId: session.id },
    });
    await handler(
      reopen.req as unknown as NextApiRequest,
      reopen.res as unknown as NextApiResponse,
    );
    expect(reopen.res._getStatusCode()).toBe(400);

    await prisma.chatSession.delete({ where: { id: session.id } });
    await prisma.user.delete({ where: { id: admin.userId } });
  });

  it.skip('sessionActions returns 400 when session is not claimable', async () => {
    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    const actions = (await import('@/pages/api/chat/sessionActions.page'))
      .default;

    const join = createMocks({
      method: 'POST',
      url: '/api/chat/sessionActions',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      body: { sessionId: '00000000-0000-4000-8000-000000000099' },
    });
    await actions(
      join.req as unknown as NextApiRequest,
      join.res as unknown as NextApiResponse,
    );
    expect(join.res._getStatusCode()).toBe(400);

    await prisma.user.delete({ where: { id: admin.userId } });
  });

  it('PATCH chat message updates isRead', async () => {
    const free = await signupTestUser('chat-msg');
    const session = await prisma.chatSession.create({
      data: {
        status: 'ACTIVE',
        users: { connect: { id: free.userId } },
      },
    });
    const msg = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        senderId: free.userId,
        senderRole: UserRole.FREE,
        content: 'hello',
        isRead: false,
      },
    });

    const handler = (await import('@/pages/api/chat/message.page')).default;
    const patch = createMocks({
      method: 'PATCH',
      url: '/api/chat/message',
      headers: { authorization: `Bearer ${free.accessToken}` },
      body: { messageId: msg.id, isRead: true },
    });
    await handler(
      patch.req as unknown as NextApiRequest,
      patch.res as unknown as NextApiResponse,
    );
    expect(patch.res._getStatusCode()).toBe(200);
    expect(JSON.parse(patch.res._getData() as string).data.isRead).toBe(true);

    await prisma.chatSession.delete({ where: { id: session.id } });
  });

  it('DELETE message forbidden for FREE, allowed for SUPERUSER', async () => {
    const free = await signupTestUser('chat-del');
    const su = await createStaffPrincipal(prisma, UserRole.SUPERUSER);
    const session = await prisma.chatSession.create({
      data: {
        status: 'ACTIVE',
        users: { connect: { id: free.userId } },
      },
    });
    const msg = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        senderId: free.userId,
        senderRole: UserRole.FREE,
        content: 'delme',
      },
    });

    const handler = (await import('@/pages/api/chat/message.page')).default;

    const asFree = createMocks({
      method: 'DELETE',
      url: '/api/chat/message',
      headers: { authorization: `Bearer ${free.accessToken}` },
      body: { messageId: msg.id },
    });
    await handler(
      asFree.req as unknown as NextApiRequest,
      asFree.res as unknown as NextApiResponse,
    );
    expect(asFree.res._getStatusCode()).toBe(403);

    const asSu = createMocks({
      method: 'DELETE',
      url: '/api/chat/message',
      headers: { authorization: `Bearer ${su.accessToken}` },
      body: { messageId: msg.id },
    });
    await handler(
      asSu.req as unknown as NextApiRequest,
      asSu.res as unknown as NextApiResponse,
    );
    expect(asSu.res._getStatusCode()).toBe(200);

    await prisma.chatSession.delete({ where: { id: session.id } });
    await prisma.user.delete({ where: { id: su.userId } });
  });

  it('ADMIN POST session returns 403', async () => {
    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    const handler = (await import('@/pages/api/chat/session.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/chat/session',
      headers: { authorization: `Bearer ${admin.accessToken}` },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(403);
    await prisma.user.delete({ where: { id: admin.userId } });
  });

  it('SUPERUSER can DELETE chat session', async () => {
    const free = await signupTestUser('chat-su-del');
    const su = await createStaffPrincipal(prisma, UserRole.SUPERUSER);
    const sessionHandler = (await import('@/pages/api/chat/session.page'))
      .default;

    const post = createMocks({
      method: 'POST',
      url: '/api/chat/session',
      headers: { authorization: `Bearer ${free.accessToken}` },
    });
    await sessionHandler(
      post.req as unknown as NextApiRequest,
      post.res as unknown as NextApiResponse,
    );
    const sessionId = JSON.parse(post.res._getData() as string).data.id;

    const del = createMocks({
      method: 'DELETE',
      url: '/api/chat/session',
      headers: { authorization: `Bearer ${su.accessToken}` },
      body: { sessionId },
    });
    await sessionHandler(
      del.req as unknown as NextApiRequest,
      del.res as unknown as NextApiResponse,
    );
    expect(del.res._getStatusCode()).toBe(200);

    await prisma.user.delete({ where: { id: su.userId } });
  });
});
