import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
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

async function invokeApi(
  handler: NextApiHandler,
  method: 'POST' | 'DELETE',
  token: string,
  {
    query = {},
    body,
  }: { query?: Record<string, string>; body?: Record<string, string> } = {},
): Promise<number> {
  const { req, res } = createMocks({
    method,
    query,
    body,
    headers: { authorization: `Bearer ${token}` },
  });
  await handler(
    req as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  );
  return res._getStatusCode();
}

describe('product brand is required (integration)', () => {
  let prisma: PrismaClient;
  let adminToken: string;
  let categoryId: string;
  let brandId: string;
  let uploadDir: string;
  let productHandler: NextApiHandler;
  let brandHandler: NextApiHandler;
  let seq = 0;
  // Names and slugs are unique, and one test can create several in a millisecond.
  const unique = () => {
    seq += 1;
    return `${Date.now()} ${seq}`;
  };

  const createProduct = (fields: Record<string, string>) =>
    invokeProductApi('POST', adminToken, {
      name: JSON.stringify({ en: `Brand Req Phone ${unique()}` }),
      categoryId,
      ...fields,
    });
  const createProductId = async (fields: Record<string, string>) => {
    const created = await createProduct(fields);
    expect(created.status).toBe(200);
    return (created.json.data as { id: string }).id;
  };
  const createBrandId = async () =>
    (
      await prisma.brand.create({
        data: { name: `Lifecycle brand ${unique()}` },
      })
    ).id;
  const deleteProduct = (productId: string) =>
    invokeApi(productHandler, 'DELETE', adminToken, { query: { productId } });
  const deleteBrand = (id: string) =>
    invokeApi(brandHandler, 'DELETE', adminToken, { query: { id } });
  const postBrand = (name: string) =>
    invokeApi(brandHandler, 'POST', adminToken, { body: { name } });

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
    productHandler = (await import('@/pages/api/product/index.page')).default;
    brandHandler = (await import('@/pages/api/brand/index.page')).default;
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
    const productId = await createProductId({ brandId });

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

  it('deleting a brand unlinks its products, deleted ones included', async () => {
    const doomedBrandId = await createBrandId();
    const activeId = await createProductId({ brandId: doomedBrandId });
    const deletedId = await createProductId({ brandId: doomedBrandId });
    expect(await deleteProduct(deletedId)).toBe(200);

    expect(await deleteBrand(doomedBrandId)).toBe(200);
    const products = await prisma.product.findMany({
      where: { id: { in: [activeId, deletedId] } },
    });
    expect(products.map((product) => product.brandId)).toEqual([null, null]);
  });

  // Brands are hard-deleted today. Soft-deleting them would keep the name
  // taken, the way a deleted product's name already is.
  it('a deleted brand name can be created again', async () => {
    const name = `Reused brand ${unique()}`;
    expect(await postBrand(name)).toBe(201);
    const { id } = await prisma.brand.findUniqueOrThrow({ where: { name } });
    expect(await deleteBrand(id)).toBe(200);

    expect(await postBrand(name)).toBe(201);
  });

  // Only clearing a brand is refused: a product that lost its brand must
  // still take the overview's stock toggle, which sends no brand.
  it('PUT without a brand still saves a brandless product', async () => {
    const goneBrandId = await createBrandId();
    const productId = await createProductId({ brandId: goneBrandId });
    expect(await deleteBrand(goneBrandId)).toBe(200);

    const stock = await invokeProductApi(
      'PUT',
      adminToken,
      { isOutOfStock: 'true' },
      { productId },
    );
    expect(stock.status).toBe(200);
    const afterStock = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });
    expect(afterStock.outOfStockAt).not.toBeNull();
    expect(afterStock.brandId).toBeNull();

    const fixed = await invokeProductApi(
      'PUT',
      adminToken,
      { brandId },
      { productId },
    );
    expect(fixed.status).toBe(200);
    expect(
      (await prisma.product.findUnique({ where: { id: productId } }))?.brandId,
    ).toBe(brandId);
  });

  it('deleting a product lowers its brand count', async () => {
    const countedBrandId = await createBrandId();
    await createProductId({ brandId: countedBrandId });
    const deletedId = await createProductId({ brandId: countedBrandId });
    const count = async () =>
      (await prisma.brand.findUniqueOrThrow({ where: { id: countedBrandId } }))
        .productCount;
    expect(await count()).toBe(2);

    expect(await deleteProduct(deletedId)).toBe(200);
    expect(await count()).toBe(1);
  });
});
