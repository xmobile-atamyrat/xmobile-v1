import { Readable } from 'node:stream';

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, UserRole } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

const BOUNDARY = 'pricelinks';

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

describe('/api/product price ownership (integration)', () => {
  let prisma: PrismaClient;
  let adminToken: string;
  let categoryId: string;
  let seq = 0;

  const newPrice = (name: string) =>
    prisma.prices.create({
      data: { name, price: '1', priceInTmt: '20.00', categoryId },
    });
  const ownerOf = async (priceId: string) =>
    (await prisma.prices.findUniqueOrThrow({ where: { id: priceId } }))
      .productId;

  // What the product form posts on every save: price and tags always present.
  const createProduct = async (price: string, tags: string[]) => {
    seq += 1;
    return invokeProductApi({
      method: 'POST',
      token: adminToken,
      fields: {
        name: JSON.stringify({ en: `Price Link Phone ${seq} ${Date.now()}` }),
        categoryId,
        price,
        tags: JSON.stringify(tags),
        isOutOfStock: 'false',
      },
    });
  };
  const saveProduct = (productId: string, price: string, tags: string[]) =>
    invokeProductApi({
      method: 'PUT',
      token: adminToken,
      query: { productId },
      fields: {
        categoryId,
        price,
        tags: JSON.stringify(tags),
        isOutOfStock: 'false',
      },
    });

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();
    adminToken = (await createStaffPrincipal(prisma, UserRole.ADMIN))
      .accessToken;
    categoryId = catalog.categoryId;
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('frees a wrongly picked variant price once the tag is removed', async () => {
    const wrong = await newPrice('wrong pick');
    const productA = (await createProduct('', [])).json.data.id as string;
    const productB = (await createProduct('', [])).json.data.id as string;

    const picked = await saveProduct(productA, '', [`128gb [${wrong.id}]`]);
    expect(picked.status).toBe(200);
    expect(await ownerOf(wrong.id)).toBe(productA);

    // While A still holds it, B is refused and keeps its old tags.
    const refused = await saveProduct(productB, '', [`256gb [${wrong.id}]`]);
    expect(refused.status).toBe(409);
    expect(refused.json.message).toBe('priceTakenByAnotherProduct');
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: productB } }))
        .tags,
    ).toEqual([]);

    const removed = await saveProduct(productA, '', []);
    expect(removed.status).toBe(200);
    expect(await ownerOf(wrong.id)).toBeNull();

    const claimed = await saveProduct(productB, '', [`256gb [${wrong.id}]`]);
    expect(claimed.status).toBe(200);
    expect(await ownerOf(wrong.id)).toBe(productB);
  });

  it('swapping or clearing the base price releases the old one', async () => {
    const first = await newPrice('first base');
    const second = await newPrice('second base');
    const created = await createProduct(`[${first.id}]`, []);
    expect(created.status).toBe(200);
    const productId = created.json.data.id as string;
    expect(await ownerOf(first.id)).toBe(productId);

    await saveProduct(productId, `[${second.id}]`, []);
    expect(await ownerOf(first.id)).toBeNull();
    expect(await ownerOf(second.id)).toBe(productId);

    const cleared = await saveProduct(productId, '', []);
    expect(cleared.status).toBe(200);
    expect(cleared.json.data.price).toBeNull();
    expect(await ownerOf(second.id)).toBeNull();
  });

  it('refuses to create a product on a taken price and creates nothing', async () => {
    const taken = await newPrice('taken on create');
    const owner = (await createProduct(`[${taken.id}]`, [])).json.data
      .id as string;
    const before = await prisma.product.count();

    const refused = await createProduct('', [`64gb [${taken.id}]`]);
    expect(refused.status).toBe(409);
    expect(await prisma.product.count()).toBe(before);
    expect(await ownerOf(taken.id)).toBe(owner);
  });

  it('a save without price/tags leaves ownership alone', async () => {
    // A link the references never mention, as the products overview would
    // find it: its partial saves must not release it.
    const linked = await newPrice('overview untouched');
    const productId = (await createProduct('', [])).json.data.id as string;
    await prisma.prices.update({
      where: { id: linked.id },
      data: { productId },
    });

    const res = await invokeProductApi({
      method: 'PUT',
      token: adminToken,
      query: { productId },
      fields: { categoryId, isOutOfStock: 'false' },
    });
    expect(res.status).toBe(200);
    expect(await ownerOf(linked.id)).toBe(productId);
  });

  it('keeps saving a product that already shared a price before ownership', async () => {
    const shared = await newPrice('legacy shared');
    const owner = (await createProduct(`[${shared.id}]`, [])).json.data
      .id as string;
    // A second product referencing the same price, as legacy data does.
    const sharer = (await createProduct('', [])).json.data.id as string;
    await prisma.product.update({
      where: { id: sharer },
      data: { tags: [`legacy [${shared.id}]`] },
    });

    const res = await saveProduct(sharer, '', [`legacy [${shared.id}]`]);
    expect(res.status).toBe(200);
    expect(await ownerOf(shared.id)).toBe(owner);
  });

  it('a product created sold out pushes its state onto the prices it claims', async () => {
    const price = await newPrice('sold out on create');
    seq += 1;
    const created = await invokeProductApi({
      method: 'POST',
      token: adminToken,
      fields: {
        name: JSON.stringify({ en: `Sold Out Link ${seq} ${Date.now()}` }),
        categoryId,
        price: `[${price.id}]`,
        tags: '[]',
        isOutOfStock: 'true',
      },
    });
    expect(created.status).toBe(200);
    expect(created.json.data.outOfStockAt).not.toBeNull();
    const row = await prisma.prices.findUniqueOrThrow({
      where: { id: price.id },
    });
    expect(row.productId).toBe(created.json.data.id);
    expect(row.outOfStockAt).not.toBeNull();
  });
});
