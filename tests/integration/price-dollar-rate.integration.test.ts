import { PrismaClient, UserRole } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks, RequestMethod } from 'node-mocks-http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  assignPricesToRate,
  createRate,
  deleteRate,
  updateRate,
} from '@/lib/dollarRateService';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

// One database is shared by every integration file, so this one namespaces the
// rows it creates and never truncates a table: globalSetup's catalogue prices
// live here too, and other files reach them through `catalog.priceId`.
const PREFIX = 'rate-test ';

describe('per-price dollar rates (integration)', () => {
  let prisma: PrismaClient;
  let defaultRateId: number;
  let bazarRateId: number;
  let categoryId: string;
  let catalogueBefore: {
    id: string;
    priceInTmt: string;
    displayPriceTmt: string | null;
    dollarRateId: number | null;
  }[];
  let cachedPricesBefore: { id: string; cachedPrice: number | null }[];

  const seedPrice = (name: string, usd: string, dollarRateId: number | null) =>
    prisma.prices.create({
      data: {
        name: `${PREFIX}${name}`,
        price: usd,
        priceInTmt: '0',
        dollarRateId,
      },
    });

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    categoryId = catalog.categoryId;
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    // Editing the default rate rewrites every price in the database, the shared
    // catalogue's included, so their prior state is kept and restored below.
    catalogueBefore = await prisma.prices.findMany({
      select: {
        id: true,
        priceInTmt: true,
        displayPriceTmt: true,
        dollarRateId: true,
      },
    });
    // A repricing also mirrors the new manat figure into the cachedPrice of
    // every product holding that price, and that column is what the catalogue
    // filters its price ranges on — so it is snapshotted and put back too.
    cachedPricesBefore = await prisma.product.findMany({
      select: { id: true, cachedPrice: true },
    });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({
      where: { slug: { startsWith: PREFIX } },
    });
    await prisma.prices.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.dollarRate.deleteMany({
      where: { name: { startsWith: PREFIX } },
    });
    // Rates are gone first, so restoring dollarRateId cannot collide with a
    // SetNull still to come.
    await Promise.all(
      catalogueBefore.map((row) =>
        prisma.prices.update({
          where: { id: row.id },
          data: {
            priceInTmt: row.priceInTmt,
            displayPriceTmt: row.displayPriceTmt,
            dollarRateId: row.dollarRateId,
          },
        }),
      ),
    );
    // updateMany rather than update: the products this file created are already
    // gone, and a snapshot row for one of them must not abort the restore.
    await Promise.all(
      cachedPricesBefore.map((row) =>
        prisma.product.updateMany({
          where: { id: row.id },
          data: { cachedPrice: row.cachedPrice },
        }),
      ),
    );
    await prisma.$disconnect();
    resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  beforeEach(async () => {
    await prisma.prices.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.dollarRate.deleteMany({
      where: { name: { startsWith: PREFIX } },
    });
    const def = await prisma.dollarRate.create({
      data: {
        name: `${PREFIX}Esasy`,
        rate: 19.5,
        currency: 'TMT',
        isDefault: true,
      },
    });
    const bazar = await prisma.dollarRate.create({
      data: { name: `${PREFIX}Bazar`, rate: 19.8, currency: 'TMT' },
    });
    // Keeps foreign rows off the rates under test, so a case reading back "the
    // prices on this rate" sees only the ones it seeded. It does not contain a
    // default-rate edit — that one reprices the whole table whatever a row is
    // filed under, which is why afterAll restores rather than prevents. The FK
    // is SetNull, so deleting this rate hands the rows back unchanged.
    const parked = await prisma.dollarRate.create({
      data: { name: `${PREFIX}Parked`, rate: 1, currency: 'TMT' },
    });
    await prisma.prices.updateMany({
      where: { dollarRateId: null, NOT: { name: { startsWith: PREFIX } } },
      data: { dollarRateId: parked.id },
    });
    defaultRateId = def.id;
    bazarRateId = bazar.id;
  });

  describe('updateRate', () => {
    it('recomputes only the prices assigned to that rate', async () => {
      const onBazar = await seedPrice('bazar price', '50', bazarRateId);
      const onDefault = await seedPrice('default price', '50', defaultRateId);

      await updateRate(prisma, { id: bazarRateId, rate: 20 });

      expect(
        await prisma.prices.findUniqueOrThrow({ where: { id: onBazar.id } }),
      ).toMatchObject({ priceInTmt: '1000', displayPriceTmt: '1000' });
      // Untouched: still the '0' it was seeded with, not recomputed.
      expect(
        await prisma.prices.findUniqueOrThrow({ where: { id: onDefault.id } }),
      ).toMatchObject({ priceInTmt: '0' });
    });

    it('sweeps up unassigned prices when the default rate changes', async () => {
      const orphan = await seedPrice('unassigned', '50', null);

      await updateRate(prisma, { id: defaultRateId, rate: 19.8 });

      expect(
        await prisma.prices.findUniqueOrThrow({ where: { id: orphan.id } }),
      ).toMatchObject({ priceInTmt: '990', displayPriceTmt: '990' });
    });

    // The default rate is the whole table's rate: approving a change to it puts
    // every price back on the default, so no price is left on another one.
    it('moves every price back onto the default rate', async () => {
      const onBazar = await seedPrice('swept from bazar', '50', bazarRateId);
      const unassigned = await seedPrice('swept unassigned', '50', null);

      await updateRate(prisma, { id: defaultRateId, rate: 20 });

      expect(
        await prisma.prices.findUniqueOrThrow({ where: { id: onBazar.id } }),
      ).toMatchObject({
        dollarRateId: defaultRateId,
        priceInTmt: '1000',
        displayPriceTmt: '1000',
      });
      expect(
        await prisma.prices.findUniqueOrThrow({ where: { id: unassigned.id } }),
      ).toMatchObject({ dollarRateId: defaultRateId, priceInTmt: '1000' });
    });

    // The rate itself survives the sweep; it is simply left with no prices on
    // it, ready to be assigned again.
    it('keeps the other rate rows after the sweep', async () => {
      await updateRate(prisma, { id: defaultRateId, rate: 20 });

      expect(
        await prisma.dollarRate.findUnique({ where: { id: bazarRateId } }),
      ).toMatchObject({ rate: 19.8 });
    });

    it('leaves a non-numeric legacy price alone', async () => {
      const legacy = await prisma.prices.create({
        data: {
          name: 'call for price',
          price: 'NaN',
          priceInTmt: 'call us',
          dollarRateId: bazarRateId,
        },
      });

      await updateRate(prisma, { id: bazarRateId, rate: 20 });

      expect(
        await prisma.prices.findUniqueOrThrow({ where: { id: legacy.id } }),
      ).toMatchObject({ priceInTmt: 'call us' });
    });
  });

  describe('createRate', () => {
    it('creates a non-default manat rate', async () => {
      const created = await createRate(prisma, {
        name: `${PREFIX}Optom`,
        rate: 19.2,
      });

      expect(created).toMatchObject({
        name: `${PREFIX}Optom`,
        rate: 19.2,
        currency: 'TMT',
        isDefault: false,
      });
    });

    it('rejects a name already in use', async () => {
      await expect(
        createRate(prisma, { name: `${PREFIX}Bazar`, rate: 19.9 }),
      ).rejects.toThrow(/name/i);
    });
  });

  describe('deleteRate', () => {
    it('reassigns its prices to the default and reprices them there', async () => {
      const stranded = await seedPrice('stranded', '50', bazarRateId);

      await deleteRate(prisma, bazarRateId);

      expect(
        await prisma.prices.findUniqueOrThrow({ where: { id: stranded.id } }),
      ).toMatchObject({
        dollarRateId: defaultRateId,
        priceInTmt: '975',
        displayPriceTmt: '980',
      });
    });

    it('refuses to delete the default rate', async () => {
      await expect(deleteRate(prisma, defaultRateId)).rejects.toThrow(
        /default/i,
      );
      expect(
        await prisma.dollarRate.findUnique({ where: { id: defaultRateId } }),
      ).not.toBeNull();
    });
  });

  describe('assignPricesToRate', () => {
    it('moves the given prices and reprices them at the new rate', async () => {
      const moved = await seedPrice('moving', '50', defaultRateId);
      const untouched = await seedPrice('staying', '50', defaultRateId);

      await assignPricesToRate(prisma, {
        priceIds: [moved.id],
        rateId: bazarRateId,
      });

      expect(
        await prisma.prices.findUniqueOrThrow({ where: { id: moved.id } }),
      ).toMatchObject({
        dollarRateId: bazarRateId,
        priceInTmt: '990',
        displayPriceTmt: '990',
      });
      expect(
        await prisma.prices.findUniqueOrThrow({ where: { id: untouched.id } }),
      ).toMatchObject({ dollarRateId: defaultRateId, priceInTmt: '0' });
    });
  });
  describe('the /api/prices/rate route', () => {
    const callRoute = async (
      method: RequestMethod,
      body: Record<string, unknown>,
      accessToken: string,
    ) => {
      const handler = (await import('@/pages/api/prices/rate.page')).default;
      const { req, res } = createMocks({
        method,
        url: '/api/prices/rate',
        headers: { authorization: `Bearer ${accessToken}` },
        body,
      });
      await handler(
        req as unknown as NextApiRequest,
        res as unknown as NextApiResponse,
      );
      return res;
    };

    let accessToken: string;
    let staffUserId: string;

    beforeEach(async () => {
      const staff = await createStaffPrincipal(prisma, UserRole.SUPERUSER);
      accessToken = staff.accessToken;
      staffUserId = staff.userId;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { id: staffUserId } });
    });

    it('creates a named price rate from a POST carrying a name', async () => {
      const res = await callRoute(
        'POST',
        { name: `${PREFIX}Optom`, rate: 19.2 },
        accessToken,
      );

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData()).data).toMatchObject({
        name: `${PREFIX}Optom`,
        rate: 19.2,
        isDefault: false,
      });
    });

    it('answers 409 when the name is taken', async () => {
      const res = await callRoute(
        'POST',
        { name: `${PREFIX}Bazar`, rate: 19.9 },
        accessToken,
      );

      expect(res._getStatusCode()).toBe(409);
    });

    it('recomputes the prices of the rate named by a PUT id', async () => {
      const price = await seedPrice('put by id', '50', bazarRateId);

      const res = await callRoute(
        'PUT',
        { id: bazarRateId, rate: 20 },
        accessToken,
      );

      expect(res._getStatusCode()).toBe(200);
      expect(
        await prisma.prices.findUniqueOrThrow({ where: { id: price.id } }),
      ).toMatchObject({ priceInTmt: '1000' });
    });

    it('refuses to DELETE the default rate', async () => {
      const res = await callRoute('DELETE', { id: defaultRateId }, accessToken);

      expect(res._getStatusCode()).toBe(400);
    });

    // Procurement still edits its AED/CNY/USD rates by currency, and that form
    // has to keep working now that ids address price rates.
    it('still updates a procurement rate addressed by currency', async () => {
      const before = await prisma.dollarRate.findFirst({
        where: { currency: 'CNY' },
      });

      const res = await callRoute(
        'PUT',
        { rate: 7.25, currency: 'CNY' },
        accessToken,
      );

      expect(res._getStatusCode()).toBe(200);
      expect(
        await prisma.dollarRate.findFirst({ where: { currency: 'CNY' } }),
      ).toMatchObject({ rate: 7.25 });

      if (before == null) {
        await prisma.dollarRate.deleteMany({ where: { currency: 'CNY' } });
      } else {
        await prisma.dollarRate.update({
          where: { id: before.id },
          data: { rate: before.rate },
        });
      }
    });
  });
  describe('saving a rate change through PUT /api/prices', () => {
    const savePrices = async (
      pricePairs: Record<string, unknown>[],
      accessToken: string,
    ) => {
      const handler = (await import('@/pages/api/prices/index.page')).default;
      const { req, res } = createMocks({
        method: 'PUT' as RequestMethod,
        url: '/api/prices',
        headers: { authorization: `Bearer ${accessToken}` },
        body: { pricePairs },
      });
      await handler(
        req as unknown as NextApiRequest,
        res as unknown as NextApiResponse,
      );
      return res;
    };

    let accessToken: string;
    let staffUserId: string;

    beforeEach(async () => {
      const staff = await createStaffPrincipal(prisma, UserRole.SUPERUSER);
      accessToken = staff.accessToken;
      staffUserId = staff.userId;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { id: staffUserId } });
    });

    it('reprices a row at its new rate', async () => {
      const price = await seedPrice('moving row', '50', defaultRateId);

      const res = await savePrices(
        [{ id: price.id, dollarRateId: bazarRateId }],
        accessToken,
      );

      expect(res._getStatusCode()).toBe(200);
      expect(
        await prisma.prices.findUniqueOrThrow({ where: { id: price.id } }),
      ).toMatchObject({
        dollarRateId: bazarRateId,
        priceInTmt: '990',
        displayPriceTmt: '990',
      });
    });

    // Clearing the rate drops the price onto the default, which is what prices
    // the row from then on.
    it('reprices at the default rate when the rate is cleared', async () => {
      const price = await seedPrice('clearing', '50', bazarRateId);

      await savePrices([{ id: price.id, dollarRateId: null }], accessToken);

      expect(
        await prisma.prices.findUniqueOrThrow({ where: { id: price.id } }),
      ).toMatchObject({
        dollarRateId: null,
        priceInTmt: '975',
        displayPriceTmt: '980',
      });
    });

    // A display price typed in the same save is a deliberate pin and must
    // survive the repricing that the rate change triggers.
    it('keeps a display price pinned in the same save', async () => {
      const price = await seedPrice('pinned', '50', defaultRateId);

      await savePrices(
        [{ id: price.id, dollarRateId: bazarRateId, displayPriceTmt: '1111' }],
        accessToken,
      );

      expect(
        await prisma.prices.findUniqueOrThrow({ where: { id: price.id } }),
      ).toMatchObject({
        dollarRateId: bazarRateId,
        displayPriceTmt: '1111',
      });
    });
  });
  // cachedPrice is the manat figure the storefront filters and sorts on. A rate
  // change rewrites the price it mirrors, so it has to follow or products drop
  // out of the price ranges they belong in.
  describe('cachedPrice after a rate change', () => {
    const seedProduct = async (slug: string, priceId: string) =>
      prisma.product.create({
        data: {
          slug,
          name: `{"en":"${slug}"}`,
          categoryId,
          imgUrls: [],
          tags: [],
          videoUrls: [],
          price: `[${priceId}]`,
          cachedPrice: 0,
        },
      });

    it('follows the repriced value when its rate is edited', async () => {
      const price = await seedPrice('cached row', '50', bazarRateId);
      const product = await seedProduct(
        `${PREFIX}cached-rate-${Date.now()}`,
        price.id,
      );

      await updateRate(prisma, { id: bazarRateId, rate: 20 });

      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
      ).toMatchObject({ cachedPrice: 1000 });
    });

    it('follows a bulk reassignment to another rate', async () => {
      const price = await seedPrice('bulk cached', '50', defaultRateId);
      const product = await seedProduct(
        `${PREFIX}cached-bulk-${Date.now()}`,
        price.id,
      );

      await assignPricesToRate(prisma, {
        priceIds: [price.id],
        rateId: bazarRateId,
      });

      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
      ).toMatchObject({ cachedPrice: 990 });
    });
  });
  describe('the /api/prices/assign-rate route', () => {
    let accessToken: string;
    let staffUserId: string;

    const callAssign = async (body: Record<string, unknown>, token: string) => {
      const handler = (await import('@/pages/api/prices/assign-rate.page'))
        .default;
      const { req, res } = createMocks({
        method: 'PUT' as RequestMethod,
        url: '/api/prices/assign-rate',
        headers: { authorization: `Bearer ${token}` },
        body,
      });
      await handler(
        req as unknown as NextApiRequest,
        res as unknown as NextApiResponse,
      );
      return res;
    };

    beforeEach(async () => {
      const staff = await createStaffPrincipal(prisma, UserRole.SUPERUSER);
      accessToken = staff.accessToken;
      staffUserId = staff.userId;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { id: staffUserId } });
    });

    it('moves every named price onto the rate and reprices them', async () => {
      const first = await seedPrice('bulk one', '50', defaultRateId);
      const second = await seedPrice('bulk two', '100', defaultRateId);
      const untouched = await seedPrice('bulk three', '50', defaultRateId);

      const res = await callAssign(
        { priceIds: [first.id, second.id], rateId: bazarRateId },
        accessToken,
      );

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData()).data).toMatchObject({
        updatedCount: 2,
      });
      expect(
        await prisma.prices.findUniqueOrThrow({ where: { id: first.id } }),
      ).toMatchObject({ dollarRateId: bazarRateId, priceInTmt: '990' });
      expect(
        await prisma.prices.findUniqueOrThrow({ where: { id: second.id } }),
      ).toMatchObject({ dollarRateId: bazarRateId, priceInTmt: '1980' });
      expect(
        await prisma.prices.findUniqueOrThrow({ where: { id: untouched.id } }),
      ).toMatchObject({ dollarRateId: defaultRateId, priceInTmt: '0' });
    });

    it('answers 404 for a rate that does not exist', async () => {
      const price = await seedPrice('bulk missing', '50', defaultRateId);

      const res = await callAssign(
        { priceIds: [price.id], rateId: 999999 },
        accessToken,
      );

      expect(res._getStatusCode()).toBe(404);
    });

    it('rejects a caller who is not staff', async () => {
      const res = await callAssign(
        { priceIds: [], rateId: bazarRateId },
        'not-a-token',
      );

      expect(res._getStatusCode()).toBe(401);
    });
  });
});
