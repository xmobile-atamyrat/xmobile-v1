import { Readable } from 'node:stream';

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, UserRole } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { RECOMMENDED_PRODUCTS_MAX } from '@/pages/lib/constants';
import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal, StaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

const BOUNDARY = 'rectoggle';

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

describe('Recommended flag on the product form (integration)', () => {
  let prisma: PrismaClient;
  let admin: StaffPrincipal;
  let categoryId: string;
  let brandId: string;
  const ids: string[] = [];

  const makeProduct = async (label: string, recommendedOrder?: number) => {
    const product = await prisma.product.create({
      data: {
        slug: `rec-toggle-${label}-${Date.now()}-${ids.length}`,
        name: JSON.stringify({ en: `Rec toggle ${label}` }),
        categoryId,
        brandId,
        imgUrls: [`/media/rec-toggle-${label}.webp`],
        tags: [],
        videoUrls: [],
        recommendedOrder,
      },
    });
    ids.push(product.id);
    return product.id;
  };

  const orderOf = async (id: string) =>
    (await prisma.product.findUniqueOrThrow({ where: { id } }))
      .recommendedOrder;

  const save = (productId: string, fields: Record<string, string>) =>
    invokeProductApi({
      method: 'PUT',
      token: admin.accessToken,
      query: { productId },
      fields: { isOutOfStock: 'false', ...fields },
    });

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    categoryId = catalog.categoryId;
    brandId = catalog.brandId;
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
  }, 180_000);

  beforeEach(async () => {
    await prisma.product.updateMany({
      where: { recommendedOrder: { not: null } },
      data: { recommendedOrder: null },
    });
  });

  afterAll(async () => {
    // Shared database: these must not linger in later files' product lists.
    await prisma?.product.deleteMany({ where: { id: { in: ids } } });
    await prisma?.user.deleteMany({ where: { id: admin?.userId } });
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('adds a product to the end of the list', async () => {
    const first = await makeProduct('first', 0);
    const second = await makeProduct('second', 4);
    const added = await makeProduct('added');

    const res = await save(added, { isRecommended: 'true' });

    expect(res.status).toBe(200);
    expect(res.json.data.recommendedOrder).toBe(5);
    expect(await orderOf(first)).toBe(0);
    expect(await orderOf(second)).toBe(4);
  });

  it('takes a product off without touching the others', async () => {
    const kept = await makeProduct('kept', 0);
    const removed = await makeProduct('removed', 1);

    const res = await save(removed, { isRecommended: 'false' });

    expect(res.status).toBe(200);
    expect(await orderOf(removed)).toBeNull();
    expect(await orderOf(kept)).toBe(0);
  });

  it('leaves the list alone when the field is not sent', async () => {
    const picked = await makeProduct('untouched', 2);

    const res = await save(picked, { categoryId });

    expect(res.status).toBe(200);
    expect(await orderOf(picked)).toBe(2);
  });

  it('keeps the current place when an already listed product is re-sent', async () => {
    const picked = await makeProduct('resent', 7);

    const res = await save(picked, { isRecommended: 'true' });

    expect(res.status).toBe(200);
    expect(await orderOf(picked)).toBe(7);
  });

  it('creates a product straight onto the list', async () => {
    await makeProduct('existing', 3);

    const res = await invokeProductApi({
      method: 'POST',
      token: admin.accessToken,
      fields: {
        name: JSON.stringify({ en: `Rec toggle created ${Date.now()}` }),
        categoryId,
        brandId,
        price: '',
        tags: '[]',
        isOutOfStock: 'false',
        isRecommended: 'true',
      },
    });

    expect(res.status).toBe(200);
    ids.push(res.json.data.id);
    expect(res.json.data.recommendedOrder).toBe(4);
  });

  it('refuses to add to a full list and saves nothing', async () => {
    for (let i = 0; i < RECOMMENDED_PRODUCTS_MAX; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await makeProduct(`full-${i}`, i);
    }
    const extra = await makeProduct('extra');
    const newName = JSON.stringify({ en: 'Rec toggle renamed' });

    const res = await save(extra, { isRecommended: 'true', name: newName });

    expect(res.status).toBe(400);
    expect(res.json.message).toBe('recommendedListFull');
    const row = await prisma.product.findUniqueOrThrow({
      where: { id: extra },
    });
    expect(row.recommendedOrder).toBeNull();
    expect(row.name).not.toBe(newName);
  });
});
