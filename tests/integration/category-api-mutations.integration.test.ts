import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, UserRole } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

function multipartBody(
  fields: Record<string, string>,
  boundary: string,
): string {
  const chunks: string[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}`,
    );
  }
  chunks.push(`--${boundary}--`);
  return chunks.join('\r\n');
}

async function invokeCategoryApi(options: {
  method: 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ status: number; json: Record<string, unknown> }> {
  const categoryHandler = (await import('@/pages/api/category.page')).default;
  const { req, res } = createMocks({
    method: options.method,
    url: '/api/category',
    query: options.query ?? {},
    headers: options.headers ?? {},
    body:
      options.body != null
        ? (Buffer.from(
            options.body,
            'utf8',
          ) as unknown as import('node-mocks-http').Body)
        : undefined,
  });
  await categoryHandler(
    req as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  );
  const status = res._getStatusCode();
  const raw = res._getData() as string;
  const json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  return { status, json };
}

describe('/api/category mutations (integration)', () => {
  let prisma: PrismaClient;
  let adminToken: string;
  let freeToken: string;
  let uploadDir: string;

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cat-mut-'));
    vi.stubEnv('CATEGORY_IMAGES_DIR', uploadDir);

    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();

    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    adminToken = admin.accessToken;
    const free = await signupTestUser('cat-mut-free');
    freeToken = free.accessToken;
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    fs.rmSync(uploadDir, { recursive: true, force: true });
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('POST returns 401 without Authorization', async () => {
    const boundary = 'intboundpost401';
    const body = multipartBody({ name: '{"en":"x"}' }, boundary);
    const { status, json } = await invokeCategoryApi({
      method: 'POST',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('POST returns 401 for non-staff token', async () => {
    const boundary = 'intboundpostfree';
    const body = multipartBody({ name: '{"en":"y"}' }, boundary);
    const { status, json } = await invokeCategoryApi({
      method: 'POST',
      headers: {
        authorization: `Bearer ${freeToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('PUT returns 401 without Authorization', async () => {
    const boundary = 'intboundput401';
    const body = multipartBody({ name: '{"en":"z"}' }, boundary);
    const { status, json } = await invokeCategoryApi({
      method: 'PUT',
      query: { categoryId: '00000000-0000-4000-8000-000000000001' },
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('PUT returns 401 for non-staff token', async () => {
    const boundary = 'intboundputfree';
    const body = multipartBody({ name: '{"en":"z"}' }, boundary);
    const { status, json } = await invokeCategoryApi({
      method: 'PUT',
      query: { categoryId: '00000000-0000-4000-8000-000000000002' },
      headers: {
        authorization: `Bearer ${freeToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('DELETE returns 401 without Authorization', async () => {
    const { status, json } = await invokeCategoryApi({
      method: 'DELETE',
      query: { categoryId: '00000000-0000-4000-8000-000000000003' },
    });
    expect(status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('DELETE returns 401 for non-staff token', async () => {
    const { status, json } = await invokeCategoryApi({
      method: 'DELETE',
      query: { categoryId: '00000000-0000-4000-8000-000000000004' },
      headers: { authorization: `Bearer ${freeToken}` },
    });
    expect(status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('ADMIN PUT updates popular flag via multipart', async () => {
    const cat = await prisma.category.create({
      data: {
        name: '{"en":"Popular test"}',
        sortOrder: 0,
        popular: false,
      },
    });
    try {
      const boundary = 'intboundpop';
      const body = multipartBody(
        {
          name: '{"en":"Popular test"}',
          popular: 'true',
        },
        boundary,
      );
      const { status, json } = await invokeCategoryApi({
        method: 'PUT',
        query: { categoryId: cat.id },
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });
      expect(status).toBe(200);
      expect(json.success).toBe(true);
      const updated = await prisma.category.findUnique({
        where: { id: cat.id },
      });
      expect(updated?.popular).toBe(true);
    } finally {
      await prisma.category.delete({ where: { id: cat.id } });
    }
  });

  it('ADMIN DELETE soft-deletes a category', async () => {
    const cat = await prisma.category.create({
      data: {
        name: '{"en":"To delete"}',
        sortOrder: 0,
      },
    });
    const { status, json } = await invokeCategoryApi({
      method: 'DELETE',
      query: { categoryId: cat.id },
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    const row = await prisma.category.findUnique({ where: { id: cat.id } });
    expect(row?.deletedAt).not.toBeNull();
    await prisma.category.delete({ where: { id: cat.id } });
  });

  it('ADMIN POST creates a root category', async () => {
    const boundary = 'intboundcreate';
    const body = multipartBody({ name: '{"en":"New root"}' }, boundary);
    const { status, json } = await invokeCategoryApi({
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    const data = json.data as { id: string };
    expect(data?.id).toBeTruthy();
    const row = await prisma.category.findUnique({ where: { id: data.id } });
    expect(row?.name).toContain('New root');
    await prisma.category.delete({ where: { id: data.id } });
  });
});
