import { DollarRate, Prisma, PrismaClient } from '@prisma/client';

import { cachedPriceFrom } from '@/pages/lib/priceDisplay';

import {
  findDefaultRate,
  pricesAtRate,
  recomputedPriceFields,
} from '@/lib/dollarRates';

// Carries the HTTP status the route should answer with, so the API layer stays a
// thin translation of these errors rather than re-deriving each case.
export class RateError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'RateError';
  }
}

// Price rates are always dollars to manat. The other currencies in the table
// belong to procurement and are never offered as a price rate.
const PRICE_CURRENCY = 'TMT' as const;

const cleanName = (name: string): string => {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) throw new RateError('Rate name is required', 400);
  return trimmed;
};

const cleanRate = (rate: number): number => {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RateError('Rate must be a positive number', 400);
  }
  return rate;
};

const assertNameFree = async (
  db: PrismaClient,
  name: string,
  exceptId?: number,
): Promise<void> => {
  const clash = await db.dollarRate.findFirst({
    where: {
      currency: PRICE_CURRENCY,
      name,
      ...(exceptId == null ? {} : { id: { not: exceptId } }),
    },
  });
  if (clash != null) {
    throw new RateError(`A rate with the name "${name}" already exists`, 409);
  }
};

// Rewrites the manat columns of every price matching `where` at `rate`. Rows
// whose dollar price is not a number are skipped, not zeroed.
const repriceMatching = async (
  db: PrismaClient,
  where: Prisma.PricesWhereInput,
  rate: number,
): Promise<number> => {
  const prices = await db.prices.findMany({
    where,
    select: { id: true, price: true },
  });

  const repriced = prices.flatMap(({ id, price }) => {
    const fields = recomputedPriceFields(price, rate);
    return fields == null ? [] : [{ id, fields }];
  });

  if (repriced.length === 0) return 0;

  await db.$transaction(
    repriced.map(({ id, fields }) =>
      db.prices.update({ where: { id }, data: fields }),
    ),
  );

  // cachedPrice is the manat figure the catalogue filters and sorts on, so it
  // has to move with the price it mirrors or products fall out of the ranges
  // they belong in.
  await Promise.all(
    repriced.map(({ id, fields }) => {
      const shown = cachedPriceFrom(fields);
      if (shown == null) return null;
      return db.product.updateMany({
        where: {
          deletedAt: null,
          OR: [{ price: id }, { price: { contains: `[${id}]` } }],
        },
        data: { cachedPrice: shown },
      });
    }),
  );

  return repriced.length;
};

export const listRates = (db: PrismaClient): Promise<DollarRate[]> =>
  db.dollarRate.findMany({
    where: { currency: PRICE_CURRENCY },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });

export const createRate = async (
  db: PrismaClient,
  { name, rate }: { name: string; rate: number },
): Promise<DollarRate> => {
  const cleanedName = cleanName(name);
  const cleanedRate = cleanRate(rate);
  await assertNameFree(db, cleanedName);

  return db.dollarRate.create({
    data: {
      name: cleanedName,
      rate: cleanedRate,
      currency: PRICE_CURRENCY,
      isDefault: false,
    },
  });
};

export const updateRate = async (
  db: PrismaClient,
  { id, rate, name }: { id: number; rate: number; name?: string },
): Promise<{ rate: DollarRate; updatedCount: number }> => {
  const cleanedRate = cleanRate(rate);
  const existing = await db.dollarRate.findUnique({ where: { id } });
  if (existing == null) throw new RateError('Rate not found', 404);

  const cleanedName = name == null ? undefined : cleanName(name);
  if (cleanedName != null && cleanedName !== existing.name) {
    await assertNameFree(db, cleanedName, id);
  }

  const updated = await db.dollarRate.update({
    where: { id },
    data: {
      rate: cleanedRate,
      ...(cleanedName == null ? {} : { name: cleanedName }),
    },
  });

  // The default rate is the whole table's rate, not one bucket in it: changing
  // it puts every price back on the default, so nothing is left priced at a
  // rate the admin did not just approve. Other rate rows survive with no prices
  // on them, ready to be assigned again.
  if (updated.isDefault) {
    await db.prices.updateMany({ data: { dollarRateId: updated.id } });
  }

  const updatedCount = await repriceMatching(
    db,
    updated.isDefault ? {} : pricesAtRate(updated),
    updated.rate,
  );

  return { rate: updated, updatedCount };
};

export const deleteRate = async (
  db: PrismaClient,
  id: number,
): Promise<{ reassignedCount: number }> => {
  const target = await db.dollarRate.findUnique({ where: { id } });
  if (target == null) throw new RateError('Rate not found', 404);
  if (target.isDefault) {
    throw new RateError('The default rate cannot be deleted', 400);
  }

  const fallback = findDefaultRate(await listRates(db));
  if (fallback == null) {
    throw new RateError(
      'There is no default rate to move these prices to',
      409,
    );
  }

  // Capture the ids before the move: afterwards they are indistinguishable from
  // the prices that already sat on the default rate, which must not be repriced.
  const moving = await db.prices.findMany({
    where: { dollarRateId: id },
    select: { id: true },
  });
  const movingIds = moving.map(({ id: priceId }) => priceId);

  if (movingIds.length > 0) {
    await db.prices.updateMany({
      where: { id: { in: movingIds } },
      data: { dollarRateId: fallback.id },
    });
    await repriceMatching(db, { id: { in: movingIds } }, fallback.rate);
  }

  await db.dollarRate.delete({ where: { id } });

  return { reassignedCount: movingIds.length };
};

export const assignPricesToRate = async (
  db: PrismaClient,
  { priceIds, rateId }: { priceIds: string[]; rateId: number },
): Promise<{ updatedCount: number }> => {
  const rate = await db.dollarRate.findUnique({ where: { id: rateId } });
  if (rate == null) throw new RateError('Rate not found', 404);
  if (priceIds.length === 0) return { updatedCount: 0 };

  await db.prices.updateMany({
    where: { id: { in: priceIds } },
    data: { dollarRateId: rateId },
  });
  await repriceMatching(db, { id: { in: priceIds } }, rate.rate);

  return { updatedCount: priceIds.length };
};
