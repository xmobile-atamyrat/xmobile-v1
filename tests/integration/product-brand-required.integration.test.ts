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

const BOUNDARY = 'brandrequired';

function multipartBody(fields: Record<string, string>): string {
  const chunks = Object.entries(fields).map(
    ([name, value]) =>
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}`,
  );
  chunks.push(`--${BOUNDARY}--`);
  return chunks.join('\r\n');
}

async function invokeProductApi(
  method: 'POST' | 'PUT',
  token: string,
  fields: Record<string, string>,
  query: Record<string, string> = {},
): Promise<{ status: number; json: Record<string, unknown> }> {
  const handler = (await import('@/pages/api/product/index.page')).default;
  const { req: mockReq, res } = createMocks({
    method,
    url: '/api/product',
    query,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
    },
  });
  const req = Object.assign(
    Readable.from(Buffer.from(multipartBody(fields), 'utf8')),
    {
      url: '/api/product',
      method,
      headers: mockReq.headers,
      query: mockReq.query,
    },
  ) as unknown as NextApiRequest;
  await handler(req, res as unknown as NextApiResponse);
  const raw = res._getData() as string;
  return { status: res._getStatusCode(), json: raw ? JSON.parse(raw) : {} };
}

describe('product brand is required (integration)', () => {
  let prisma: PrismaClient;
  let adminToken: string;
  let categoryId: string;
  let brandId: string;
  let uploadDir: string;

  const createProduct = (fields: Record<string, string>) =>
    invokeProductApi('POST', adminToken, {
      name: JSON.stringify({ en: `Brand Req Phone ${Date.now()}` }),
      categoryId,
      ...fields,
    });

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-brand-'));
    vi.stubEnv('PRODUCT_IMAGES_DIR', uploadDir);

    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    adminToken = (await createStaffPrincipal(prisma, UserRole.ADMIN))
      .accessToken;
    categoryId = catalog.categoryId;
    brandId = catalog.brandId;
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    fs.rmSync(uploadDir, { recursive: true, force: true });
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('POST without a brand returns 400 brandRequired', async () => {
    const { status, json } = await createProduct({});
    expect(status).toBe(400);
    expect(json.message).toBe('brandRequired');
  });

  it('POST with an unknown brand returns 400 brandNotFound', async () => {
    const { status, json } = await createProduct({
      brandId: '00000000-0000-4000-8000-000000000000',
    });
    expect(status).toBe(400);
    expect(json.message).toBe('brandNotFound');
  });

  it('PUT cannot clear the brand', async () => {
    const created = await createProduct({ brandId });
    expect(created.status).toBe(200);
    const productId = (created.json.data as { id: string }).id;

    const { status, json } = await invokeProductApi(
      'PUT',
      adminToken,
      { categoryId, brandId: '' },
      { productId },
    );
    expect(status).toBe(400);
    expect(json.message).toBe('brandRequired');
    const after = await prisma.product.findUnique({ where: { id: productId } });
    expect(after?.brandId).toBe(brandId);
  });
});
