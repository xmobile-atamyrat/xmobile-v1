import { readFileSync } from 'node:fs';
import path from 'node:path';

import { PrismaClient, UserRole } from '@prisma/client';
import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { createMocks, RequestMethod } from 'node-mocks-http';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { updateRate } from '@/lib/dollarRateService';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { signupTestUser } from './shared/signup-test-user';
import { createStaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

// One database is shared by every integration file, so this one keeps to its own
// category and prefix.
const PREFIX = 'sale-test';

describe('products on sale (integration)', () => {
  let prisma: PrismaClient;
  let adminToken: string;
  let categoryId: string;
  let brandId: string;
  let seq = 0;

  async function call(
    handler: NextApiHandler,
    method: RequestMethod,
    options: { query?: object; body?: object; token?: string } = {},
  ) {
    const { req, res } = createMocks({
      method,
      url: '/api/test',
      query: (options.query ?? {}) as Record<string, string>,
      body: options.body as Record<string, string>,
      headers: options.token
        ? { authorization: `Bearer ${options.token}` }
        : {},
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    return { status: res._getStatusCode(), json: res._getJSONData() };
  }

  const productsApi = async (query: Record<string, string>) =>
    call((await import('@/pages/api/product/index.page')).default, 'GET', {
      query: { categoryIds: categoryId, ...query },
    });

  const putPrices = async (pricePairs: object[]) =>
    call((await import('@/pages/api/prices/index.page')).default, 'PUT', {
      token: adminToken,
      body: { pricePairs },
    });

  const newPrice = (
    regular: string,
    salePriceTmt: string | null = null,
    extra: { outOfStockAt?: Date; usd?: string; dollarRateId?: number } = {},
  ) => {
    seq += 1;
    return prisma.prices.create({
      data: {
        name: `${PREFIX} price ${seq}`,
        price: extra.usd ?? '1',
        priceInTmt: regular,
        displayPriceTmt: regular,
        salePriceTmt,
        outOfStockAt: extra.outOfStockAt,
        dollarRateId: extra.dollarRateId,
      },
    });
  };

  const newProduct = (
    slug: string,
    data: {
      price?: string | null;
      tags?: string[];
      outOfStockAt?: Date;
      deletedAt?: Date;
      createdAt?: Date;
      cachedPrice?: number;
    },
  ) =>
    prisma.product.create({
      data: {
        slug: `${PREFIX}-${slug}`,
        name: JSON.stringify({ en: `${PREFIX} ${slug}` }),
        categoryId,
        brandId,
        imgUrls: ['/media/sale.webp'],
        videoUrls: [],
        tags: [],
        ...data,
      },
    });

  const cachedPriceOf = async (id: string) =>
    (await prisma.product.findUniqueOrThrow({ where: { id } })).cachedPrice;

  const salePriceOf = async (id: string) =>
    (await prisma.prices.findUniqueOrThrow({ where: { id } })).salePriceTmt;

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    brandId = catalog.brandId;
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    adminToken = (await createStaffPrincipal(prisma, UserRole.ADMIN))
      .accessToken;
    categoryId = (
      await prisma.category.create({
        data: { name: `{"en":"${PREFIX}"}`, slug: `${PREFIX}-category` },
      })
    ).id;
  }, 180_000);

  const clearRows = async () => {
    await prisma.product.deleteMany({
      where: { slug: { startsWith: PREFIX } },
    });
    await prisma.prices.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.dollarRate.deleteMany({
      where: { name: { startsWith: PREFIX } },
    });
  };

  beforeEach(clearRows);

  afterAll(async () => {
    await clearRows();
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  describe('storefront', () => {
    // base: 10% off its base price. variant: only a tag price is on sale (30%).
    // legacy: a bare-id base price (20%). The rest must not count.
    const seed = async () => {
      const base = await newPrice('1000', '900');
      const plain = await newPrice('1000');
      const variant = await newPrice('1000', '700');
      const bare = await newPrice('1000', '800');
      const soldOutPrice = await newPrice('1000', '100', {
        outOfStockAt: new Date(),
      });
      const soldOutProductPrice = await newPrice('1000', '100');
      const deletedPrice = await newPrice('1000', '100');
      const staleSale = await newPrice('1000', '1200');

      return {
        base: await newProduct('base', { price: `[${base.id}]` }),
        variant: await newProduct('variant', {
          price: `[${plain.id}]`,
          tags: [`128gb [${plain.id}]`, `256gb [${variant.id}]`],
        }),
        legacy: await newProduct('legacy', { price: bare.id }),
        plain: await newProduct('plain', { price: `[${plain.id}]` }),
        soldOutVariant: await newProduct('sold-out-variant', {
          price: `[${plain.id}]`,
          tags: [`512gb [${soldOutPrice.id}]`],
        }),
        soldOut: await newProduct('sold-out', {
          price: `[${soldOutProductPrice.id}]`,
          outOfStockAt: new Date(),
        }),
        deleted: await newProduct('deleted', {
          price: `[${deletedPrice.id}]`,
          deletedAt: new Date(),
        }),
        stale: await newProduct('stale', { price: `[${staleSale.id}]` }),
      };
    };

    const idsOf = (rows: { id: string }[]) => rows.map(({ id }) => id);

    it('sale=1 lists, counts and facets only in-stock products on sale', async () => {
      const seeded = await seed();
      const expected = [
        seeded.base.id,
        seeded.variant.id,
        seeded.legacy.id,
      ].sort();

      const list = await productsApi({ sale: '1' });
      expect(idsOf(list.json.data).sort()).toEqual(expected);

      expect((await productsApi({ sale: '1', count: 'true' })).json.data).toBe(
        3,
      );
      expect(
        (await productsApi({ sale: '1', facets: 'categories' })).json.data,
      ).toEqual([{ categoryId, count: 3 }]);
      // Combined with the search conditions, which also live in `AND`.
      expect(
        idsOf(
          (await productsApi({ sale: '1', searchKeyword: 'variant' })).json
            .data,
        ),
      ).toEqual([seeded.variant.id]);
    });

    it('filter options honour sale=1, relaxations included', async () => {
      await seed();
      const handler = (await import('@/pages/api/product/filters.page'))
        .default;

      const found = await call(handler, 'GET', {
        query: { categoryIds: categoryId, sale: '1' },
      });
      expect(found.json.data.total).toBe(3);
      expect(found.json.data.brandCounts).toEqual({ [brandId]: 3 });

      const empty = await call(handler, 'GET', {
        query: { categoryIds: categoryId, sale: '1', brandIds: 'nobody' },
      });
      expect(empty.json.data.total).toBe(0);
      // Every active filter is counted; dropping "sale" alone still finds none.
      expect(empty.json.data.relaxations).toEqual({ brands: 3, sale: 0 });
    });

    it('annotates each product with its sale', async () => {
      const seeded = await seed();
      const list = await productsApi({});
      const saleOf = (id: string) =>
        list.json.data.find((p: { id: string }) => p.id === id);

      expect(saleOf(seeded.base.id).sale).toEqual({
        bestPercent: 10,
        base: { oldPrice: '1000', percent: 10 },
      });
      expect(saleOf(seeded.base.id).price).toMatch(/^\[[^\]]+\]\{900\}$/);
      expect(saleOf(seeded.variant.id).sale).toEqual({
        bestPercent: 30,
        base: null,
      });
      expect(saleOf(seeded.legacy.id).sale.base).toEqual({
        oldPrice: '1000',
        percent: 20,
      });
      [
        seeded.plain,
        seeded.soldOutVariant,
        seeded.soldOut,
        seeded.stale,
      ].forEach(({ id }) => expect(saleOf(id).sale).toBeNull());

      const single = await productsApi({ productId: seeded.base.id });
      expect(single.json.data.sale.bestPercent).toBe(10);
    });

    it('annotates new, category and favorite products too', async () => {
      const seeded = await seed();
      const expected = { bestPercent: 30, base: null as null };
      const find = (rows: { id: string }[]) =>
        rows.find(({ id }) => id === seeded.variant.id);

      const fresh = await call(
        (await import('@/pages/api/product/new.page')).default,
        'GET',
        { query: { searchKeyword: PREFIX } },
      );
      expect(find(fresh.json.data)).toMatchObject({ sale: expected });

      const category = await call(
        (await import('@/pages/api/category.page')).default,
        'GET',
        { query: { categoryId } },
      );
      expect(find(category.json.data.products)).toMatchObject({
        sale: expected,
      });

      const session = await signupTestUser('sale-favorites');
      await prisma.user.update({
        where: { id: session.userId },
        data: { favorites: { connect: { id: seeded.variant.id } } },
      });
      const favorites = await call(
        (await import('@/pages/api/favorites.page')).default,
        'GET',
        { token: session.accessToken },
      );
      expect(find(favorites.json.data)).toMatchObject({ sale: expected });
    });

    it('sortBy=discount pages by biggest discount, then newest', async () => {
      const day = (n: number) => new Date(Date.UTC(2026, 0, n));
      const withSaleAt = async (slug: string, sale: string, n: number) => {
        const price = await newPrice('1000', sale);
        return newProduct(slug, {
          price: `[${price.id}]`,
          createdAt: day(n),
        });
      };
      const small = await withSaleAt('small', '900', 5);
      const bigOld = await withSaleAt('big-old', '500', 1);
      const bigNew = await withSaleAt('big-new', '500', 2);
      const middle = await withSaleAt('middle', '700', 3);
      const plain = await newPrice('1000');
      await newProduct('not-on-sale', { price: `[${plain.id}]` });

      const pageOf = async (page: string) =>
        idsOf(
          (await productsApi({ sortBy: 'discount', limit: '3', page })).json
            .data,
        );

      expect(await pageOf('1')).toEqual([bigNew.id, bigOld.id, middle.id]);
      expect(await pageOf('2')).toEqual([small.id]);
      expect(await pageOf('3')).toEqual([]);
      expect(
        (await productsApi({ sortBy: 'discount', count: 'true' })).json.data,
      ).toBe(4);
    });
  });

  describe('PUT /api/prices', () => {
    it('sets and clears a sale, moving cachedPrice with it', async () => {
      const price = await newPrice('1000');
      const product = await newProduct('cached', {
        price: `[${price.id}]`,
        cachedPrice: 1000,
      });

      const set = await putPrices([{ id: price.id, salePriceTmt: ' 850 ' }]);
      expect(set.status).toBe(200);
      expect(await salePriceOf(price.id)).toBe('850');
      expect(await cachedPriceOf(product.id)).toBe(850);

      await vi.waitFor(async () => {
        const logged = await prisma.adminActivity.findFirst({
          where: { entityId: price.id },
        });
        expect(logged?.meta).toMatchObject({
          changes: { salePriceTmt: { from: null, to: '850' } },
        });
      });

      // A save that doesn't mention the sale keeps it.
      await putPrices([{ id: price.id, name: price.name }]);
      expect(await salePriceOf(price.id)).toBe('850');

      await putPrices([{ id: price.id, salePriceTmt: '' }]);
      expect(await salePriceOf(price.id)).toBeNull();
      expect(await cachedPriceOf(product.id)).toBe(1000);

      await putPrices([{ id: price.id, salePriceTmt: '850' }]);
      await putPrices([{ id: price.id, salePriceTmt: null }]);
      expect(await salePriceOf(price.id)).toBeNull();
    });

    it('drops a sale from cachedPrice while its row is sold out', async () => {
      const price = await newPrice('1000', '900');
      const product = await newProduct('sold-out-sale', {
        price: `[${price.id}]`,
        cachedPrice: 900,
      });

      await putPrices([{ id: price.id, isOutOfStock: true }]);
      expect(await cachedPriceOf(product.id)).toBe(1000);

      // A sale typed onto a sold-out row is stored but not shown yet.
      await putPrices([{ id: price.id, salePriceTmt: '800' }]);
      expect(await cachedPriceOf(product.id)).toBe(1000);

      await putPrices([{ id: price.id, isOutOfStock: false }]);
      expect(await cachedPriceOf(product.id)).toBe(800);
    });

    it.each(['0', '-1', 'abc', '1e2', '1000', '1500'])(
      'rejects the sale price %s without writing any pair',
      async (salePriceTmt) => {
        const first = await newPrice('1000');
        const second = await newPrice('1000');

        const res = await putPrices([
          { id: first.id, salePriceTmt: '500' },
          { id: second.id, salePriceTmt },
        ]);

        expect(res.status).toBe(400);
        expect(res.json.message).toBe('salePriceInvalid');
        expect(await salePriceOf(first.id)).toBeNull();
        expect(await salePriceOf(second.id)).toBeNull();
      },
    );

    it('checks the sale against the price this same save leaves', async () => {
      const raised = await newPrice('1000');
      expect(
        (
          await putPrices([
            { id: raised.id, displayPriceTmt: '2000', salePriceTmt: '1500' },
          ])
        ).status,
      ).toBe(200);

      const lowered = await newPrice('1000');
      expect(
        (
          await putPrices([
            { id: lowered.id, displayPriceTmt: '800', salePriceTmt: '900' },
          ])
        ).status,
      ).toBe(400);

      // 100 USD at 5 is 500 manat, so 900 is no longer below the price.
      const rate = await prisma.dollarRate.create({
        data: { name: `${PREFIX} low`, rate: 5, currency: 'TMT' },
      });
      const repriced = await newPrice('1000', null, { usd: '100' });
      expect(
        (
          await putPrices([
            { id: repriced.id, dollarRateId: rate.id, salePriceTmt: '900' },
          ])
        ).status,
      ).toBe(400);
      expect(
        (
          await putPrices([
            { id: repriced.id, dollarRateId: rate.id, salePriceTmt: '400' },
          ])
        ).status,
      ).toBe(200);
    });

    it('never refuses a save over a stored sale that no longer applies', async () => {
      const price = await newPrice('1000', '900');
      const product = await newProduct('stale-save', {
        price: `[${price.id}]`,
      });

      const res = await putPrices([{ id: price.id, displayPriceTmt: '800' }]);

      expect(res.status).toBe(200);
      expect(await salePriceOf(price.id)).toBe('900');
      expect(await cachedPriceOf(product.id)).toBe(800);
    });
  });

  it('keeps the sale through a rate change and caches the effective price', async () => {
    const rate = await prisma.dollarRate.create({
      data: { name: `${PREFIX} rate`, rate: 10, currency: 'TMT' },
    });
    const price = await newPrice('1000', '900', {
      usd: '100',
      dollarRateId: rate.id,
    });
    const product = await newProduct('rate', { price: `[${price.id}]` });

    await updateRate(prisma, { id: rate.id, rate: 12 });
    expect(await salePriceOf(price.id)).toBe('900');
    expect(await cachedPriceOf(product.id)).toBe(900);

    // Below the sale price: the regular price takes over, the sale is kept.
    await updateRate(prisma, { id: rate.id, rate: 8 });
    expect(await salePriceOf(price.id)).toBe('900');
    expect(await cachedPriceOf(product.id)).toBe(800);
  });

  it('follows the stock of a product in the cached sale price', async () => {
    const product = await newProduct('product-stock', { cachedPrice: 900 });
    const price = await newPrice('1000', '900');
    await prisma.prices.update({
      where: { id: price.id },
      data: { productId: product.id },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { price: `[${price.id}]` },
    });

    const { setProductOutOfStock } = await import('@/lib/outOfStock');
    await setProductOutOfStock(product.id, true);
    expect(await cachedPriceOf(product.id)).toBe(1000);

    await setProductOutOfStock(product.id, false);
    expect(await cachedPriceOf(product.id)).toBe(900);
  });

  it('charges the sale price on an order', async () => {
    const base = await newPrice('1000', '900');
    const variant = await newPrice('2000', '1500');
    const tag = `256gb [${variant.id}]`;
    const plainLine = await newProduct('order-base', {
      price: `[${base.id}]`,
    });
    const variantLine = await newProduct('order-variant', {
      price: `[${base.id}]`,
      tags: [tag],
    });
    const session = await signupTestUser('sale-buyer');
    await prisma.cartItem.createMany({
      data: [
        { userId: session.userId, productId: plainLine.id, quantity: 2 },
        {
          userId: session.userId,
          productId: variantLine.id,
          selectedVariant: tag,
          quantity: 1,
        },
      ],
    });

    const order = await call(
      (await import('@/pages/api/order/index.page')).default,
      'POST',
      {
        token: session.accessToken,
        body: {
          deliveryAddress: '1 Sale Street',
          deliveryPhone: '+99361000778',
        },
      },
    );

    expect(order.status).toBe(200);
    const stored = await prisma.userOrder.findUniqueOrThrow({
      where: { id: order.json.data.id },
      include: { items: true },
    });
    expect(Number(stored.totalPrice)).toBe(3300);
    expect(stored.items.map((item) => item.productPrice).sort()).toEqual([
      '1500',
      '900',
    ]);
  });

  it('backfill_prices.sql caches what displayPriceOf shows', async () => {
    const cases: [string, string | null, string | null, number | null][] = [
      ['1000', '1000', '900', 900],
      ['1000', null, '900', 900],
      ['1000', '0', '1100', 1000],
      ['1000', '1000', 'abc', 1000],
      ['1000', '1000', '0', 1000],
      ['call', '1000', '900', 900],
      ['call', null, '900', null],
    ];
    const products = await Promise.all(
      cases.map(async ([priceInTmt, displayPriceTmt, salePriceTmt], index) => {
        const price = await prisma.prices.create({
          data: {
            name: `${PREFIX} backfill ${index}`,
            price: '1',
            priceInTmt,
            displayPriceTmt,
            salePriceTmt,
          },
        });
        return newProduct(`backfill-${index}`, {
          price: `[${price.id}]`,
          cachedPrice: null,
        });
      }),
    );
    const soldOut = await newPrice('1000', '900', {
      outOfStockAt: new Date(),
    });
    products.push(
      await newProduct('backfill-sold-out', {
        price: `[${soldOut.id}]`,
        cachedPrice: null,
      }),
    );
    const sql = readFileSync(
      path.join(process.cwd(), 'scripts/backfill_prices.sql'),
      'utf8',
    );
    const statements = sql
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.startsWith('UPDATE'));
    expect(statements).toHaveLength(2);

    // Rolled back: the script rewrites every product in the shared database.
    const rollback = new Error('rollback');
    let cached: (number | null)[] = [];
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(statements[0]);
        await tx.$executeRawUnsafe(statements[1]);
        const rows = await tx.product.findMany({
          where: { id: { in: products.map(({ id }) => id) } },
        });
        cached = products.map(
          ({ id }) => rows.find((row) => row.id === id)!.cachedPrice,
        );
        throw rollback;
      }),
    ).rejects.toBe(rollback);

    expect(cached).toEqual([
      ...cases.map(([, , , expected]) => expected),
      1000,
    ]);
  });
});
