import { AdminActivityInput, logAdminActivities } from '@/lib/adminActivity';
import { categoryLabel } from '@/lib/categoryActivity';
import {
  collectActiveSubtreeCategoryIds,
  withAncestorCategoryIds,
} from '@/lib/categoryHierarchy';
import dbClient from '@/lib/dbClient';
import { inStockFirst, whereActiveProduct } from '@/lib/prismaActiveScope';
import { productSearchWhere } from '@/lib/productSearchWhere';
import { revalidateInBackground } from '@/lib/revalidate';
import { categoryListingPaths } from '@/lib/revalidateTargets';
import addCors from '@/pages/api/utils/addCors';
import { requireStaffBearerAuth } from '@/pages/api/utils/staffAuth';
import {
  LISTING_RANK_MAX,
  LISTING_RANK_MAX_CHANGES,
} from '@/pages/lib/listingRank';
import { ResponseApi } from '@/pages/lib/types';
import { Prisma } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

const filepath = 'src/pages/api/product/listing-rank.page.ts';

export const LISTING_RANK_UNRANKED_PAGE_SIZE = 30;

export interface ListingRankProductItem {
  id: string;
  slug: string;
  /** Raw multi-locale JSON; the admin screen picks the locale. */
  name: string;
  categoryName: string;
  imgUrl: string | null;
  isOutOfStock: boolean;
  listingRank: number | null;
}

/** What `GET ?part=unranked` returns: one page of the unranked list. */
export interface ListingRankUnrankedPage {
  unranked: ListingRankProductItem[];
  unrankedHasMore: boolean;
}

export interface ListingRankList extends ListingRankUnrankedPage {
  ranked: (ListingRankProductItem & { listingRank: number })[];
  /** The number "Add" starts from; null once no free number is left. */
  nextRank: number | null;
}

export interface ListingRankConflict {
  listingRank: number;
  productName: string;
  categoryName: string;
}

/** The 409 body's `data` when a number was taken by someone else. */
export interface ListingRankTaken {
  conflict: ListingRankConflict | null;
  nextRank: number | null;
}

const itemSelect = {
  id: true,
  slug: true,
  name: true,
  imgUrls: true,
  outOfStockAt: true,
  listingRank: true,
  categories: { select: { name: true } },
} satisfies Prisma.ProductSelect;

type ItemRow = Prisma.ProductGetPayload<{ select: typeof itemSelect }>;

const toItem = (row: ItemRow): ListingRankProductItem => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  categoryName: row.categories.name,
  imgUrl: row.imgUrls[0] ?? null,
  isOutOfStock: row.outOfStockAt != null,
  listingRank: row.listingRank,
});

const getQuerySchema = z.object({
  categoryId: z.string().min(1).max(64),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  // Search and "Show more" only need the unranked page, not the whole list.
  part: z.literal('unranked').optional(),
});

const putBodySchema = z.object({
  categoryId: z.string().min(1).max(64),
  changes: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
        listingRank: z.number().int().min(1).max(LISTING_RANK_MAX).nullable(),
      }),
    )
    .min(1)
    .max(LISTING_RANK_MAX_CHANGES, 'tooManyChanges')
    .refine(
      (changes) =>
        new Set(changes.map(({ productId }) => productId)).size ===
        changes.length,
      'duplicateProduct',
    )
    .refine((changes) => {
      const ranks = changes
        .map(({ listingRank }) => listingRank)
        .filter((rank): rank is number => rank != null);
      return new Set(ranks).size === ranks.length;
    }, 'duplicateListingRank'),
});

async function unrankedPage(
  categoryIds: string[],
  q = '',
  page = 1,
): Promise<ListingRankUnrankedPage> {
  const term = q.trim();
  const rows = await dbClient.product.findMany({
    where: {
      ...whereActiveProduct,
      categoryId: { in: categoryIds },
      listingRank: null,
      ...(term.length >= 2 ? { AND: productSearchWhere(term) } : {}),
    },
    orderBy: [inStockFirst, { createdAt: 'desc' }],
    skip: (page - 1) * LISTING_RANK_UNRANKED_PAGE_SIZE,
    take: LISTING_RANK_UNRANKED_PAGE_SIZE + 1,
    select: itemSelect,
  });
  return {
    unranked: rows.slice(0, LISTING_RANK_UNRANKED_PAGE_SIZE).map(toItem),
    unrankedHasMore: rows.length > LISTING_RANK_UNRANKED_PAGE_SIZE,
  };
}

/** The first free number above `floor`, or null if there is none. */
async function firstFreeRankAbove(floor: number): Promise<number | null> {
  const rows = await dbClient.$queryRaw<{ n: number }[]>`
    SELECT s.n FROM (
      SELECT ${floor}::int + 1 AS n
      UNION ALL
      SELECT "listingRank" + 1 FROM "Product" WHERE "listingRank" > ${floor}
    ) s
    WHERE s.n <= ${LISTING_RANK_MAX}
      AND NOT EXISTS (SELECT 1 FROM "Product" p WHERE p."listingRank" = s.n)
    ORDER BY s.n
    LIMIT 1`;
  return rows[0]?.n ?? null;
}

/**
 * Normally one past the highest number in use, so an added product goes to
 * the end everywhere. Once the top number is taken (someone typed the maximum
 * to push a product to the very end), it falls back to the first free number
 * after this category's own last one, then to the first free number at all.
 */
async function findNextRank(categoryIds: string[]): Promise<number | null> {
  const top = await dbClient.product.aggregate({ _max: { listingRank: true } });
  // eslint-disable-next-line no-underscore-dangle
  const highest = top._max.listingRank ?? 0;
  if (highest < LISTING_RANK_MAX) return highest + 1;

  const own = await dbClient.product.aggregate({
    where: {
      categoryId: { in: categoryIds },
      listingRank: { lt: LISTING_RANK_MAX },
    },
    _max: { listingRank: true },
  });
  // eslint-disable-next-line no-underscore-dangle
  const floor = own._max.listingRank ?? 0;
  return (
    (await firstFreeRankAbove(floor)) ??
    (floor > 0 ? firstFreeRankAbove(0) : null)
  );
}

async function listForCategory(
  categoryIds: string[],
): Promise<ListingRankList> {
  const [ranked, unranked, nextRank] = await Promise.all([
    dbClient.product.findMany({
      where: {
        ...whereActiveProduct,
        categoryId: { in: categoryIds },
        listingRank: { not: null },
      },
      orderBy: { listingRank: 'asc' },
      select: itemSelect,
    }),
    unrankedPage(categoryIds),
    findNextRank(categoryIds),
  ]);
  return {
    ranked: ranked.map(toItem) as ListingRankList['ranked'],
    ...unranked,
    nextRank,
  };
}

class SaveRejectedError extends Error {
  constructor(
    readonly reason:
      | 'productNotFound'
      | 'productNotInCategory'
      | 'listingRankTaken',
    readonly conflict: ListingRankConflict | null = null,
  ) {
    super(reason);
  }
}

// Prisma reports a unique violation as P2002 from its own queries and as
// P2010 with Postgres' 23505 from a raw one.
const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === 'P2002' ||
    (error.code === 'P2010' && String(error.meta?.code) === '23505'));

type LockedRow = {
  id: string;
  name: string;
  categoryId: string;
  listingRank: number | null;
};

async function writeChanges(
  changes: z.infer<typeof putBodySchema>['changes'],
  categoryIds: string[],
): Promise<LockedRow[]> {
  const inCategory = new Set(categoryIds);
  const ids = changes.map(({ productId }) => productId);
  const newRanks = changes
    .map(({ listingRank }) => listingRank)
    .filter((rank): rank is number => rank != null);

  try {
    return await dbClient.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('product:listing-rank'))`;

      const rows = await tx.$queryRaw<LockedRow[]>`
        SELECT id, name, "categoryId", "listingRank" FROM "Product"
        WHERE id IN (${Prisma.join(ids)}) AND "deletedAt" IS NULL
        ORDER BY id
        FOR UPDATE`;
      if (rows.length !== ids.length)
        throw new SaveRejectedError('productNotFound');
      // The screen only ever shows this category's products, so anything else
      // is a stale or crafted request and must not renumber other categories.
      if (rows.some((row) => !inCategory.has(row.categoryId)))
        throw new SaveRejectedError('productNotInCategory');

      if (newRanks.length > 0) {
        const holder = await tx.product.findFirst({
          where: { listingRank: { in: newRanks }, id: { notIn: ids } },
          orderBy: { listingRank: 'asc' },
          select: {
            name: true,
            listingRank: true,
            categories: { select: { name: true } },
          },
        });
        if (holder?.listingRank != null) {
          throw new SaveRejectedError('listingRankTaken', {
            listingRank: holder.listingRank,
            productName: holder.name,
            categoryName: holder.categories.name,
          });
        }
      }

      // Cleared first so a reshuffle of numbers already in the set never
      // holds two products on one number.
      await tx.product.updateMany({
        where: { id: { in: ids } },
        data: { listingRank: null },
      });
      const assigned = changes.filter(({ listingRank }) => listingRank != null);
      if (assigned.length > 0) {
        const values = Prisma.join(
          assigned.map(
            ({ productId, listingRank }) =>
              Prisma.sql`(${productId}, ${listingRank}::int)`,
          ),
        );
        await tx.$executeRaw`
          UPDATE "Product" AS p SET "listingRank" = v.rank
          FROM (VALUES ${values}) AS v(id, rank)
          WHERE p.id = v.id`;
      }
      return rows;
    });
  } catch (error) {
    if (isUniqueViolation(error))
      throw new SaveRejectedError('listingRankTaken');
    throw error;
  }
}

function logChanges(
  changes: z.infer<typeof putBodySchema>['changes'],
  before: LockedRow[],
  actorId: string | undefined,
) {
  const byId = new Map(before.map((row) => [row.id, row]));
  const activities: AdminActivityInput[] = [];
  changes.forEach(({ productId, listingRank }) => {
    const row = byId.get(productId);
    if (row == null || row.listingRank === listingRank) return;
    activities.push({
      userId: actorId,
      entity: 'PRODUCT',
      action: 'UPDATE',
      entityId: productId,
      meta: {
        name: categoryLabel(row.name),
        changes: { listingRank: { from: row.listingRank, to: listingRank } },
      },
    });
  });
  if (activities.length > 0) logAdminActivities(activities);
}

/**
 * The edited category and the pages above it go out as their own small batch,
 * so the page the admin is looking at always refreshes. The other categories
 * the moved products live in follow in a second batch, which `revalidatePaths`
 * drops whole if it is too big; those pages catch up on their TTL.
 */
function revalidateListingOrder(
  res: NextApiResponse,
  categoryId: string,
  touchedCategoryIds: string[],
) {
  revalidateInBackground(res, async () =>
    categoryListingPaths(await withAncestorCategoryIds([categoryId])),
  );
  revalidateInBackground(res, async () => {
    const [primary, all] = await Promise.all([
      withAncestorCategoryIds([categoryId]),
      withAncestorCategoryIds([...new Set(touchedCategoryIds)]),
    ]);
    const done = new Set(primary);
    return categoryListingPaths(all.filter((id) => !done.has(id)));
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);
  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }
  const actor = await requireStaffBearerAuth(req, res);
  if (!actor) return undefined;

  try {
    if (req.method === 'GET') {
      const parsed = getQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid query' });
      }
      const { categoryId, q, page, part } = parsed.data;
      const categoryIds = await collectActiveSubtreeCategoryIds(categoryId);
      if (categoryIds.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'categoryNotFound' });
      }
      const data =
        part === 'unranked'
          ? await unrankedPage(categoryIds, q, page)
          : await listForCategory(categoryIds);
      return res.status(200).json({ success: true, data });
    }

    const parsed = putBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message ?? 'Invalid body',
      });
    }
    const { categoryId, changes } = parsed.data;
    const categoryIds = await collectActiveSubtreeCategoryIds(categoryId);
    if (categoryIds.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'categoryNotFound' });
    }

    let before: LockedRow[];
    try {
      before = await writeChanges(changes, categoryIds);
    } catch (error) {
      if (!(error instanceof SaveRejectedError)) throw error;
      if (error.reason !== 'listingRankTaken') {
        return res.status(409).json({ success: false, message: error.reason });
      }
      const taken: ListingRankTaken = {
        conflict: error.conflict,
        nextRank: await findNextRank(categoryIds).catch(() => null),
      };
      return res
        .status(409)
        .json({ success: false, message: error.reason, data: taken });
    }

    // Nothing below may fail the request: the numbers are already saved.
    logChanges(changes, before, actor.userId);
    revalidateListingOrder(
      res,
      categoryId,
      before.map((row) => row.categoryId),
    );

    let data: ListingRankList | null = null;
    try {
      data = await listForCategory(categoryIds);
    } catch (error) {
      console.error(filepath, 'saved, but re-listing failed', error);
    }
    return res.status(200).json({ success: true, message: 'saved', data });
  } catch (error) {
    console.error(filepath, error);
    return res.status(500).json({
      success: false,
      message: "Couldn't update the listing order",
    });
  }
}
