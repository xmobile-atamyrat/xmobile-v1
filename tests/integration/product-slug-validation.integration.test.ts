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

async function invokeProductApi(options: {
  method: 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ status: number; json: Record<string, unknown> }> {
  const productHandler = (await import('@/pages/api/product/index.page'))
    .default;
  const { req: mockReq, res } = createMocks({
    method: options.method,
    url: '/api/product',
    query: options.query ?? {},
    headers: options.headers ?? {},
  });

  let req: NextApiRequest;
  if (options.body != null) {
    const buf = Buffer.from(options.body, 'utf8');
    const bodyStream = Readable.from(buf);
    req = Object.assign(bodyStream, {
      url: '/api/product',
      method: options.method,
      headers: { ...mockReq.headers } as NextApiRequest['headers'],
      query: mockReq.query,
    }) as unknown as NextApiRequest;
  } else {
    req = mockReq as unknown as NextApiRequest;
  }

  await productHandler(req, res as unknown as NextApiResponse);
  const status = res._getStatusCode();
  const raw = res._getData() as string;
  const json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  return { status, json };
}

describe('/api/product slug validation (integration)', () => {
  let prisma: PrismaClient;
  let adminToken: string;
  let categoryId: string;
  let uploadDir: string;

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-slug-'));
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

  it('POST returns 400 when English name is missing entirely', async () => {
    const boundary = 'prodslug1';
    // Only Turkmen name – no English key at all
    const body = multipartBody(
      {
        name: '{"tk":"Telefon"}',
        categoryId,
        price: '100',
      },
      boundary,
    );
    const { status, json } = await invokeProductApi({
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.message).toBe('englishNameRequired');
  });

  it('POST returns 400 when English name is empty string', async () => {
    const boundary = 'prodslug2';
    const body = multipartBody(
      {
        name: '{"en":"","ru":"Телефон"}',
        categoryId,
        price: '100',
      },
      boundary,
    );
    const { status, json } = await invokeProductApi({
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.message).toBe('englishNameRequired');
  });

  it('POST returns 400 when English name contains only whitespace', async () => {
    const boundary = 'prodslug3';
    const body = multipartBody(
      {
        name: '{"en":"    "}',
        categoryId,
        price: '100',
      },
      boundary,
    );
    const { status, json } = await invokeProductApi({
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.message).toBe('englishNameRequired');
  });

  it('POST returns 400 when English name slugifies to empty (symbols only)', async () => {
    const boundary = 'prodslug4';
    // All characters get stripped by slugify
    const body = multipartBody(
      {
        name: '{"en":"!!! @@@ ###"}',
        categoryId,
        price: '100',
      },
      boundary,
    );
    const { status, json } = await invokeProductApi({
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.message).toBe('invalidSlugError');
  });

  it('POST creates product successfully and slug comes from English name', async () => {
    const boundary = 'prodslug5';
    const body = multipartBody(
      {
        name: '{"en":"Galaxy S24 Ultra","ru":"Галакси С24 Ультра"}',
        categoryId,
        price: '1299',
      },
      boundary,
    );
    const { status, json } = await invokeProductApi({
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    const data = json.data as { id: string; slug: string };
    // Slug is derived from English, not Russian
    expect(data.slug).toBe('galaxy-s24-ultra');
    // Cleanup
    await prisma.product.delete({ where: { id: data.id } });
  });

  it('POST Turkmen diacritics in English field are normalised to plain ASCII in slug', async () => {
    const boundary = 'prodslug6';
    // Ý, Ş, Ö, Ä all decompose correctly via NFD
    const body = multipartBody(
      {
        name: '{"en":"Ýetir Şöhle"}',
        categoryId,
        price: '200',
      },
      boundary,
    );
    const { status, json } = await invokeProductApi({
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    expect(status).toBe(200);
    const data = json.data as { id: string; slug: string };
    // After NFD normalization: ý->y, ş->s, ö->o
    expect(data.slug).toBe('yetir-sohle');
    await prisma.product.delete({ where: { id: data.id } });
  });
});
