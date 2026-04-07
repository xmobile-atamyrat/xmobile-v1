import { randomUUID } from 'node:crypto';

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, UserRole } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

async function postHierarchy(
  accessToken: string | undefined,
  body: object,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const handler = (await import('@/pages/api/category/hierarchy.page')).default;
  const { req, res } = createMocks({
    method: 'POST',
    url: '/api/category/hierarchy',
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
    body,
  });
  await handler(
    req as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  );
  const status = res._getStatusCode();
  const raw = res._getData() as string;
  const json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  return { status, json };
}

describe('Category hierarchy API (integration)', () => {
  let prisma: PrismaClient;
  const rootsToCleanup: string[] = [];
  let adminToken: string;
  let superuserToken: string;
  let freeToken: string;

  function trackRoot(id: string) {
    rootsToCleanup.push(id);
  }

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();

    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    adminToken = admin.accessToken;
    const su = await createStaffPrincipal(prisma, UserRole.SUPERUSER);
    superuserToken = su.accessToken;
    const free = await signupTestUser('hier-free');
    freeToken = free.accessToken;
  }, 180_000);

  afterEach(async () => {
    while (rootsToCleanup.length > 0) {
      const id = rootsToCleanup.pop();
      if (id) {
        await prisma.category.delete({ where: { id } }).catch(() => {});
      }
    }
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('returns 405 for GET even with staff token', async () => {
    const handler = (await import('@/pages/api/category/hierarchy.page'))
      .default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/category/hierarchy',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(405);
  });

  it('POST returns 401 without Authorization header', async () => {
    const { status } = await postHierarchy(undefined, {
      action: 'reorderSibling',
      categoryId: randomUUID(),
      direction: 'up',
    });
    expect(status).toBe(401);
  });

  it('POST returns 401 for FREE user', async () => {
    const { status, json } = await postHierarchy(freeToken, {
      action: 'reorderSibling',
      categoryId: randomUUID(),
      direction: 'up',
    });
    expect(status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('POST returns 400 for invalid body', async () => {
    const { status, json } = await postHierarchy(adminToken, {
      action: 'reorderSibling',
      categoryId: '',
      direction: 'up',
    });
    expect(status).toBe(400);
    expect(json.success).toBe(false);
  });

  it('POST reorderSibling returns 404 for unknown category', async () => {
    const { status, json } = await postHierarchy(adminToken, {
      action: 'reorderSibling',
      categoryId: randomUUID(),
      direction: 'up',
    });
    expect(status).toBe(404);
    expect(json.message).toBe('Category not found');
  });

  it('POST reorderSibling returns 400 when already first among siblings', async () => {
    const parent = await prisma.category.create({
      data: { name: '{"en":"H parent"}', slug: 'h-parent' },
    });
    trackRoot(parent.id);
    const first = await prisma.category.create({
      data: {
        name: '{"en":"H first"}',
        slug: 'h-first',
        predecessorId: parent.id,
        sortOrder: 0,
      },
    });
    await prisma.category.create({
      data: {
        name: '{"en":"H second"}',
        slug: 'h-second',
        predecessorId: parent.id,
        sortOrder: 1,
      },
    });

    const { status, json } = await postHierarchy(adminToken, {
      action: 'reorderSibling',
      categoryId: first.id,
      direction: 'up',
    });
    expect(status).toBe(400);
    expect(json.message).toBe('Already first among siblings');
  });

  it('POST reorderSibling returns 400 when already last among siblings', async () => {
    const parent = await prisma.category.create({
      data: { name: '{"en":"L parent"}', slug: 'l-parent' },
    });
    trackRoot(parent.id);
    await prisma.category.create({
      data: {
        name: '{"en":"L first"}',
        slug: 'l-first',
        predecessorId: parent.id,
        sortOrder: 0,
      },
    });
    const last = await prisma.category.create({
      data: {
        name: '{"en":"L last"}',
        slug: 'l-last',
        predecessorId: parent.id,
        sortOrder: 1,
      },
    });

    const { status, json } = await postHierarchy(adminToken, {
      action: 'reorderSibling',
      categoryId: last.id,
      direction: 'down',
    });
    expect(status).toBe(400);
    expect(json.message).toBe('Already last among siblings');
  });

  it('POST reorderSibling swaps sortOrder between two siblings', async () => {
    const parent = await prisma.category.create({
      data: { name: '{"en":"S parent"}', slug: 's-parent' },
    });
    trackRoot(parent.id);
    const a = await prisma.category.create({
      data: {
        name: '{"en":"S A"}',
        slug: 's-a',
        predecessorId: parent.id,
        sortOrder: 0,
      },
    });
    const b = await prisma.category.create({
      data: {
        name: '{"en":"S B"}',
        slug: 's-b',
        predecessorId: parent.id,
        sortOrder: 1,
      },
    });

    const { status } = await postHierarchy(adminToken, {
      action: 'reorderSibling',
      categoryId: b.id,
      direction: 'up',
    });
    expect(status).toBe(200);

    const ordered = await prisma.category.findMany({
      where: { predecessorId: parent.id, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    expect(ordered.map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it('POST setParent returns 400 when category is its own parent', async () => {
    const cat = await prisma.category.create({
      data: { name: '{"en":"self"}', slug: 'self-parent' },
    });
    trackRoot(cat.id);

    const { status, json } = await postHierarchy(adminToken, {
      action: 'setParent',
      categoryId: cat.id,
      newPredecessorId: cat.id,
    });
    expect(status).toBe(400);
    expect(json.message).toBe('Category cannot be its own parent');
  });

  it('POST setParent returns 404 for unknown category', async () => {
    const { status } = await postHierarchy(adminToken, {
      action: 'setParent',
      categoryId: randomUUID(),
      newPredecessorId: null,
    });
    expect(status).toBe(404);
  });

  it('POST setParent returns 404 for unknown parent id', async () => {
    const cat = await prisma.category.create({
      data: { name: '{"en":"orphan"}', slug: 'orphan' },
    });
    trackRoot(cat.id);

    const { status, json } = await postHierarchy(adminToken, {
      action: 'setParent',
      categoryId: cat.id,
      newPredecessorId: randomUUID(),
    });
    expect(status).toBe(404);
    expect(json.message).toBe('Parent category not found');
  });

  it('POST setParent returns 400 when new parent is inside moved subtree', async () => {
    const root = await prisma.category.create({
      data: { name: '{"en":"cycle root"}', slug: 'cycle-root' },
    });
    trackRoot(root.id);
    const mid = await prisma.category.create({
      data: {
        name: '{"en":"cycle mid"}',
        slug: 'cycle-mid',
        predecessorId: root.id,
        sortOrder: 0,
      },
    });
    const leaf = await prisma.category.create({
      data: {
        name: '{"en":"cycle leaf"}',
        slug: 'cycle-leaf',
        predecessorId: mid.id,
        sortOrder: 0,
      },
    });

    const { status, json } = await postHierarchy(adminToken, {
      action: 'setParent',
      categoryId: root.id,
      newPredecessorId: leaf.id,
    });
    expect(status).toBe(400);
    expect(json.message).toBe(
      'Cannot move a category under its own descendant',
    );
  });

  it('POST setParent moves category to root (null predecessor)', async () => {
    const parent = await prisma.category.create({
      data: { name: '{"en":"old parent"}', slug: 'old-parent' },
    });
    trackRoot(parent.id);
    const child = await prisma.category.create({
      data: {
        name: '{"en":"to root"}',
        slug: 'to-root',
        predecessorId: parent.id,
        sortOrder: 0,
      },
    });

    const { status, json } = await postHierarchy(adminToken, {
      action: 'setParent',
      categoryId: child.id,
      newPredecessorId: null,
    });
    expect(status).toBe(200);
    expect(json.success).toBe(true);

    const updated = await prisma.category.findUnique({
      where: { id: child.id },
    });
    expect(updated?.predecessorId).toBeNull();

    trackRoot(child.id);
  });

  it('POST setParent moves category under another parent and appends sortOrder', async () => {
    const p1 = await prisma.category.create({
      data: { name: '{"en":"p1"}', slug: 'p1-parent' },
    });
    const p2 = await prisma.category.create({
      data: { name: '{"en":"p2"}', slug: 'p2-parent' },
    });
    trackRoot(p1.id);
    trackRoot(p2.id);

    await prisma.category.create({
      data: {
        name: '{"en":"existing child"}',
        slug: 'existing-child',
        predecessorId: p2.id,
        sortOrder: 0,
      },
    });
    const moving = await prisma.category.create({
      data: {
        name: '{"en":"moving"}',
        slug: 'moving',
        predecessorId: p1.id,
        sortOrder: 0,
      },
    });

    const { status } = await postHierarchy(adminToken, {
      action: 'setParent',
      categoryId: moving.id,
      newPredecessorId: p2.id,
    });
    expect(status).toBe(200);

    const updated = await prisma.category.findUnique({
      where: { id: moving.id },
    });
    expect(updated?.predecessorId).toBe(p2.id);
    expect(updated?.sortOrder).toBe(1);
  });

  it('POST succeeds for SUPERUSER same as ADMIN', async () => {
    const parent = await prisma.category.create({
      data: { name: '{"en":"su parent"}', slug: 'su-parent' },
    });
    trackRoot(parent.id);
    const a = await prisma.category.create({
      data: {
        name: '{"en":"su a"}',
        slug: 'su-a',
        predecessorId: parent.id,
        sortOrder: 0,
      },
    });
    const b = await prisma.category.create({
      data: {
        name: '{"en":"su b"}',
        slug: 'su-b',
        predecessorId: parent.id,
        sortOrder: 1,
      },
    });

    const { status } = await postHierarchy(superuserToken, {
      action: 'reorderSibling',
      categoryId: b.id,
      direction: 'up',
    });
    expect(status).toBe(200);

    const ordered = await prisma.category.findMany({
      where: { predecessorId: parent.id, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }],
      select: { id: true },
    });
    expect(ordered.map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it('GET /api/category orders root categories by sortOrder then createdAt', async () => {
    const rHigh = await prisma.category.create({
      data: { name: '{"en":"order hi"}', slug: 'order-hi', sortOrder: 10 },
    });
    const rLow = await prisma.category.create({
      data: { name: '{"en":"order lo"}', slug: 'order-lo', sortOrder: 0 },
    });
    trackRoot(rHigh.id);
    trackRoot(rLow.id);

    const categoryHandler = (await import('@/pages/api/category.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/category',
      query: {},
    });
    await categoryHandler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData() as string) as {
      data: { id: string }[];
    };
    const idxLow = payload.data.findIndex((c) => c.id === rLow.id);
    const idxHigh = payload.data.findIndex((c) => c.id === rHigh.id);
    expect(idxLow).toBeGreaterThanOrEqual(0);
    expect(idxHigh).toBeGreaterThanOrEqual(0);
    expect(idxLow).toBeLessThan(idxHigh);
  });
});
