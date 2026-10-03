import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, UserRole } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

const BOUNDARY = 'prodimgorder';

function multipartBody(fields: Record<string, string>): string {
  const chunks = Object.entries(fields).map(
    ([name, value]) =>
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}`,
  );
  chunks.push(`--${BOUNDARY}--`);
  return chunks.join('\r\n');
}

async function invokeProductApi(options: {
  method: 'POST' | 'PUT';
  token: string;
  query?: Record<string, string>;
  fields: Record<string, string>;
}): Promise<{ status: number; json: Record<string, any> }> {
  const productHandler = (await import('@/pages/api/product/index.page'))
    .default;
  const { req: mockReq, res } = createMocks({
    method: options.method,
    url: '/api/product',
    query: options.query ?? {},
    headers: {
      authorization: `Bearer ${options.token}`,
      'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
    },
  });
  const req = Object.assign(
    Readable.from(Buffer.from(multipartBody(options.fields), 'utf8')),
    {
      url: '/api/product',
      method: options.method,
      headers: { ...mockReq.headers } as NextApiRequest['headers'],
      query: mockReq.query,
    },
  ) as unknown as NextApiRequest;

  await productHandler(req, res as unknown as NextApiResponse);
  const raw = res._getData() as string;
  return {
    status: res._getStatusCode(),
    json: raw ? JSON.parse(raw) : {},
  };
}

const url = (name: string) => `https://cdn.example.com/${name}.jpg`;

describe('/api/product image order (integration)', () => {
  let prisma: PrismaClient;
  let adminToken: string;
  let categoryId: string;
  let uploadDir: string;

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-img-order-'));
    vi.stubEnv('PRODUCT_IMAGES_DIR', uploadDir);

    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();

    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    adminToken = admin.accessToken;
    categoryId = catalog.categoryId;
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    fs.rmSync(uploadDir, { recursive: true, force: true });
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('stores images in the admin-chosen order on create and edit', async () => {
    const created = await invokeProductApi({
      method: 'POST',
      token: adminToken,
      fields: {
        name: '{"en":"Image Order Phone"}',
        categoryId,
        imageUrls: JSON.stringify([url('a'), url('b'), url('c')]),
        imageOrder: JSON.stringify([url('c'), url('a'), url('b')]),
      },
    });
    expect(created.status).toBe(200);
    expect(created.json.data.imgUrls).toEqual([url('c'), url('a'), url('b')]);
    const productId: string = created.json.data.id;

    // Reorder only: nothing added or removed.
    const reordered = await invokeProductApi({
      method: 'PUT',
      token: adminToken,
      query: { productId },
      fields: {
        categoryId,
        imageOrder: JSON.stringify([url('b'), url('c'), url('a')]),
      },
    });
    expect(reordered.status).toBe(200);
    expect(reordered.json.data.imgUrls).toEqual([url('b'), url('c'), url('a')]);

    // A new URL placed first, one image removed, plus a token naming nothing.
    const edited = await invokeProductApi({
      method: 'PUT',
      token: adminToken,
      query: { productId },
      fields: {
        categoryId,
        imageUrls: JSON.stringify([url('d')]),
        deleteImageUrls: JSON.stringify([url('c')]),
        imageOrder: JSON.stringify([url('d'), 'file:0', url('a'), url('b')]),
      },
    });
    expect(edited.status).toBe(200);
    expect(edited.json.data.imgUrls).toEqual([url('d'), url('a'), url('b')]);
  });

  it('keeps the previous append order when no imageOrder is sent', async () => {
    const created = await invokeProductApi({
      method: 'POST',
      token: adminToken,
      fields: {
        name: '{"en":"Legacy Order Phone"}',
        categoryId,
        imageUrls: JSON.stringify([url('x'), url('y')]),
      },
    });
    const productId: string = created.json.data.id;

    const edited = await invokeProductApi({
      method: 'PUT',
      token: adminToken,
      query: { productId },
      fields: { categoryId, imageUrls: JSON.stringify([url('z')]) },
    });
    expect(edited.json.data.imgUrls).toEqual([url('x'), url('y'), url('z')]);
  });
});
