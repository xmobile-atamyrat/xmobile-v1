import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, UserRole } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import { signupTestUser } from './shared/signup-test-user';
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

  it('ADMIN joins PENDING session via sessionActions', async () => {
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

  it('PATCH closes session (CLOSED) and 409 when already closed', async () => {
    const free = await signupTestUser('chat-close');
    const handler = (await import('@/pages/api/chat/session.page')).default;
    const auth = { authorization: `Bearer ${free.accessToken}` };

    const post = createMocks({
      method: 'POST',
      url: '/api/chat/session',
      headers: auth,
    });
    await handler(
      post.req as unknown as NextApiRequest,
      post.res as unknown as NextApiResponse,
    );
    const sessionId = JSON.parse(post.res._getData() as string).data.id;

    const close = createMocks({
      method: 'PATCH',
      url: '/api/chat/session',
      headers: auth,
      body: { chatStatus: 'CLOSED', sessionId },
    });
    await handler(
      close.req as unknown as NextApiRequest,
      close.res as unknown as NextApiResponse,
    );
    expect(close.res._getStatusCode()).toBe(200);

    const again = createMocks({
      method: 'PATCH',
      url: '/api/chat/session',
      headers: auth,
      body: { chatStatus: 'CLOSED', sessionId },
    });
    await handler(
      again.req as unknown as NextApiRequest,
      again.res as unknown as NextApiResponse,
    );
    expect(again.res._getStatusCode()).toBe(409);

    await prisma.chatSession.delete({ where: { id: sessionId } });
  });

  it('sessionActions returns 400 when session is not claimable', async () => {
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
