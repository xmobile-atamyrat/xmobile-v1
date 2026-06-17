import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

const VARIANT_A = 'variant-alpha [price-stub]{color-stub}';
const VARIANT_B = 'variant-beta [price-stub]{color-stub-2}';

describe('Cart — variant uniqueness (integration)', () => {
  let prisma: PrismaClient;
  let productId: string;

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    productId = catalog.productId;

    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();
  }, 180_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('adds a product with no variant (null selectedVariant)', async () => {
    const session = await signupTestUser('cv-null');
    const handler = (await import('@/pages/api/cart.page')).default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: { productId, quantity: 1 },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
  });

  it('rejects a duplicate when the same product and null variant already exists', async () => {
    const session = await signupTestUser('cv-dup-null');
    const handler = (await import('@/pages/api/cart.page')).default;
    const auth = { authorization: `Bearer ${session.accessToken}` };

    const first = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: auth,
      body: { productId, quantity: 1 },
    });
    await handler(
      first.req as unknown as NextApiRequest,
      first.res as unknown as NextApiResponse,
    );
    expect(first.res._getStatusCode()).toBe(200);

    const dup = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: auth,
      body: { productId, quantity: 2 },
    });
    await handler(
      dup.req as unknown as NextApiRequest,
      dup.res as unknown as NextApiResponse,
    );
    expect(dup.res._getStatusCode()).toBe(400);
    expect(JSON.parse(dup.res._getData() as string).message).toBe(
      'cartItemExistError',
    );
  });

  it('allows the same product to be added twice with different variant tags', async () => {
    const session = await signupTestUser('cv-two-variants');
    const handler = (await import('@/pages/api/cart.page')).default;
    const auth = { authorization: `Bearer ${session.accessToken}` };

    const addA = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: auth,
      body: { productId, quantity: 1, selectedVariant: VARIANT_A },
    });
    await handler(
      addA.req as unknown as NextApiRequest,
      addA.res as unknown as NextApiResponse,
    );
    expect(addA.res._getStatusCode()).toBe(200);

    const addB = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: auth,
      body: { productId, quantity: 1, selectedVariant: VARIANT_B },
    });
    await handler(
      addB.req as unknown as NextApiRequest,
      addB.res as unknown as NextApiResponse,
    );
    expect(addB.res._getStatusCode()).toBe(200);

    const get = createMocks({
      method: 'GET',
      url: '/api/cart',
      headers: auth,
    });
    await handler(
      get.req as unknown as NextApiRequest,
      get.res as unknown as NextApiResponse,
    );
    const items = JSON.parse(get.res._getData() as string).data;
    expect(items).toHaveLength(2);
  });

  it('rejects a duplicate when the same product and same variant already exists', async () => {
    const session = await signupTestUser('cv-dup-variant');
    const handler = (await import('@/pages/api/cart.page')).default;
    const auth = { authorization: `Bearer ${session.accessToken}` };

    const first = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: auth,
      body: { productId, quantity: 1, selectedVariant: VARIANT_A },
    });
    await handler(
      first.req as unknown as NextApiRequest,
      first.res as unknown as NextApiResponse,
    );
    expect(first.res._getStatusCode()).toBe(200);

    const dup = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: auth,
      body: { productId, quantity: 2, selectedVariant: VARIANT_A },
    });
    await handler(
      dup.req as unknown as NextApiRequest,
      dup.res as unknown as NextApiResponse,
    );
    expect(dup.res._getStatusCode()).toBe(400);
    expect(JSON.parse(dup.res._getData() as string).message).toBe(
      'cartItemExistError',
    );
  });

  it('GET response includes the selectedVariant field on each item', async () => {
    const session = await signupTestUser('cv-get-field');
    const handler = (await import('@/pages/api/cart.page')).default;
    const auth = { authorization: `Bearer ${session.accessToken}` };

    const add = createMocks({
      method: 'POST',
      url: '/api/cart',
      headers: auth,
      body: { productId, quantity: 1, selectedVariant: VARIANT_A },
    });
    await handler(
      add.req as unknown as NextApiRequest,
      add.res as unknown as NextApiResponse,
    );
    expect(add.res._getStatusCode()).toBe(200);

    const get = createMocks({
      method: 'GET',
      url: '/api/cart',
      headers: auth,
    });
    await handler(
      get.req as unknown as NextApiRequest,
      get.res as unknown as NextApiResponse,
    );
    const items: Array<{ selectedVariant: string | null }> = JSON.parse(
      get.res._getData() as string,
    ).data;
    expect(items.some((i) => i.selectedVariant === VARIANT_A)).toBe(true);
  });

  it('PUT updates quantity of a specific variant item and DELETE removes only that item', async () => {
    const session = await signupTestUser('cv-put-del');
    const handler = (await import('@/pages/api/cart.page')).default;
    const auth = { authorization: `Bearer ${session.accessToken}` };

    // Add two variants
    for (const v of [VARIANT_A, VARIANT_B]) {
      const add = createMocks({
        method: 'POST',
        url: '/api/cart',
        headers: auth,
        body: { productId, quantity: 1, selectedVariant: v },
      });
      await handler(
        add.req as unknown as NextApiRequest,
        add.res as unknown as NextApiResponse,
      );
    }

    const get = createMocks({ method: 'GET', url: '/api/cart', headers: auth });
    await handler(
      get.req as unknown as NextApiRequest,
      get.res as unknown as NextApiResponse,
    );
    const items: Array<{ id: string; selectedVariant: string | null }> =
      JSON.parse(get.res._getData() as string).data;
    const itemA = items.find((i) => i.selectedVariant === VARIANT_A)!;
    const itemB = items.find((i) => i.selectedVariant === VARIANT_B)!;

    // Update quantity of itemA
    const put = createMocks({
      method: 'PUT',
      url: '/api/cart',
      headers: auth,
      body: { id: itemA.id, quantity: 5 },
    });
    await handler(
      put.req as unknown as NextApiRequest,
      put.res as unknown as NextApiResponse,
    );
    expect(put.res._getStatusCode()).toBe(200);
    expect(JSON.parse(put.res._getData() as string).data.quantity).toBe(5);

    // Delete only itemB
    const del = createMocks({
      method: 'DELETE',
      url: '/api/cart',
      headers: auth,
      body: { id: itemB.id },
    });
    await handler(
      del.req as unknown as NextApiRequest,
      del.res as unknown as NextApiResponse,
    );
    expect(del.res._getStatusCode()).toBe(200);

    // itemA must still be present
    const remaining = createMocks({
      method: 'GET',
      url: '/api/cart',
      headers: auth,
    });
    await handler(
      remaining.req as unknown as NextApiRequest,
      remaining.res as unknown as NextApiResponse,
    );
    const afterDel: Array<{ id: string }> = JSON.parse(
      remaining.res._getData() as string,
    ).data;
    expect(afterDel.some((i) => i.id === itemA.id)).toBe(true);
    expect(afterDel.some((i) => i.id === itemB.id)).toBe(false);
  });
});
