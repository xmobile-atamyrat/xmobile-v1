import {
  changedFields,
  FieldChange,
  logAdminActivity,
} from '@/lib/adminActivity';
import { categoryLabel } from '@/lib/categoryActivity';
import dbClient from '@/lib/dbClient';
import type { Prisma, Prices } from '@prisma/client';

export type PriceSnapshot = Pick<
  Prices,
  | 'id'
  | 'name'
  | 'price'
  | 'priceInTmt'
  | 'displayPriceTmt'
  | 'productId'
  | 'categoryId'
  | 'dollarRateId'
  | 'outOfStockAt'
>;

/**
 * A save touching more changed prices than this is logged as one summary row.
 * The price list can save hundreds at once, and a row per price would drown the
 * feed; the per-price sentences are for the handful of edits an admin makes by
 * hand.
 */
export const PRICE_ROW_LOG_LIMIT = 10;

type NameMaps = {
  product: Map<string, string>;
  category: Map<string, string>;
  rate: Map<string, string>;
};

const nameOf = (map: Map<string, string>, id: string | number | null) =>
  id == null ? null : map.get(String(id)) ?? null;

function scalarChanges(
  before: PriceSnapshot,
  after: PriceSnapshot,
): Record<string, FieldChange> {
  const changes = changedFields(before, after, [
    'name',
    'price',
    'priceInTmt',
    'displayPriceTmt',
  ]);
  const wasOut = before.outOfStockAt != null;
  const isOut = after.outOfStockAt != null;
  if (wasOut !== isOut) changes.outOfStock = { from: wasOut, to: isOut };
  return changes;
}

const linksMoved = (before: PriceSnapshot, after: PriceSnapshot) => ({
  product: before.productId !== after.productId,
  category: before.categoryId !== after.categoryId,
  rate: before.dollarRateId !== after.dollarRateId,
});

/** Null when the save changed nothing worth recording. */
export function buildPriceUpdateMeta(
  before: PriceSnapshot,
  after: PriceSnapshot,
  names: NameMaps,
): Prisma.InputJsonObject | null {
  const changes = scalarChanges(before, after);
  const moved = linksMoved(before, after);
  if (moved.product) {
    changes.product = {
      from: nameOf(names.product, before.productId),
      to: nameOf(names.product, after.productId),
    };
  }
  if (moved.category) {
    changes.category = {
      from: nameOf(names.category, before.categoryId),
      to: nameOf(names.category, after.categoryId),
    };
  }
  if (moved.rate) {
    changes.rate = {
      from: nameOf(names.rate, before.dollarRateId),
      to: nameOf(names.rate, after.dollarRateId),
    };
  }
  if (Object.keys(changes).length === 0) return null;
  return { name: after.name, changes };
}

const ids = (values: (string | null)[]) => [
  ...new Set(values.filter((id): id is string => id != null)),
];

/** Never throws: a failed lookup only leaves a name blank in the log. */
async function resolveNames(
  pairs: { before: PriceSnapshot; after: PriceSnapshot }[],
): Promise<NameMaps> {
  const maps: NameMaps = {
    product: new Map(),
    category: new Map(),
    rate: new Map(),
  };
  const productIds = ids(
    pairs
      .filter(({ before, after }) => before.productId !== after.productId)
      .flatMap(({ before, after }) => [before.productId, after.productId]),
  );
  const categoryIds = ids(
    pairs
      .filter(({ before, after }) => before.categoryId !== after.categoryId)
      .flatMap(({ before, after }) => [before.categoryId, after.categoryId]),
  );
  const rateIds = [
    ...new Set(
      pairs
        .filter(
          ({ before, after }) => before.dollarRateId !== after.dollarRateId,
        )
        .flatMap(({ before, after }) => [
          before.dollarRateId,
          after.dollarRateId,
        ])
        .filter((id): id is number => id != null),
    ),
  ];
  try {
    const [products, categories, rates] = await Promise.all([
      productIds.length > 0
        ? dbClient.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
          })
        : [],
      categoryIds.length > 0
        ? dbClient.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true },
          })
        : [],
      rateIds.length > 0
        ? dbClient.dollarRate.findMany({
            where: { id: { in: rateIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);
    products.forEach((p) => maps.product.set(p.id, categoryLabel(p.name)));
    categories.forEach((c) => maps.category.set(c.id, categoryLabel(c.name)));
    rates.forEach((r) => maps.rate.set(String(r.id), r.name));
  } catch {
    // Names are a nicety; the row is still worth writing without them.
  }
  return maps;
}

export async function recordPricesUpdated(
  userId: string | undefined,
  pairs: { before: PriceSnapshot; after: PriceSnapshot }[],
): Promise<void> {
  const changed = pairs.filter(
    ({ before, after }) =>
      Object.keys(scalarChanges(before, after)).length > 0 ||
      Object.values(linksMoved(before, after)).some(Boolean),
  );
  if (changed.length === 0) return;

  if (changed.length > PRICE_ROW_LOG_LIMIT) {
    const fields = new Set<string>();
    changed.forEach(({ before, after }) => {
      Object.keys(scalarChanges(before, after)).forEach((key) =>
        fields.add(key),
      );
      const moved = linksMoved(before, after);
      (Object.keys(moved) as (keyof typeof moved)[]).forEach((key) => {
        if (moved[key]) fields.add(key);
      });
    });
    logAdminActivity({
      userId,
      entity: 'PRICE',
      action: 'UPDATE',
      targetId: null,
      meta: { count: changed.length, fields: [...fields] },
    });
    return;
  }

  const names = await resolveNames(changed);
  changed.forEach(({ before, after }) => {
    const meta = buildPriceUpdateMeta(before, after, names);
    if (meta == null) return;
    logAdminActivity({
      userId,
      entity: 'PRICE',
      action: 'UPDATE',
      targetId: after.id,
      meta,
    });
  });
}

export async function recordPriceCreated(
  userId: string | undefined,
  created: Pick<Prices, 'id' | 'name' | 'price' | 'productId'>,
): Promise<void> {
  const names = await resolveNames([
    {
      before: { productId: null } as PriceSnapshot,
      after: { productId: created.productId } as PriceSnapshot,
    },
  ]);
  const product = nameOf(names.product, created.productId);
  logAdminActivity({
    userId,
    entity: 'PRICE',
    action: 'CREATE',
    targetId: created.id,
    meta: {
      name: created.name,
      price: created.price,
      ...(product != null ? { product } : {}),
    },
  });
}

export function recordPriceDeleted(
  userId: string | undefined,
  deleted: Pick<Prices, 'id' | 'name' | 'price'>,
): void {
  logAdminActivity({
    userId,
    entity: 'PRICE',
    action: 'DELETE',
    targetId: deleted.id,
    meta: { name: deleted.name, price: deleted.price },
  });
}

export async function recordPricesAssignedToRate(
  userId: string | undefined,
  rateId: number,
  count: number,
): Promise<void> {
  if (count === 0) return;
  let rate: string | null = null;
  try {
    const row = await dbClient.dollarRate.findUnique({
      where: { id: rateId },
      select: { name: true },
    });
    rate = row?.name ?? null;
  } catch {
    // The count is still worth recording without the rate's name.
  }
  logAdminActivity({
    userId,
    entity: 'PRICE',
    action: 'UPDATE',
    targetId: null,
    meta: { count, fields: ['rate'], ...(rate != null ? { rate } : {}) },
  });
}
