import { AdminActivityInput, logAdminActivities } from '@/lib/adminActivity';
import { categoryLabel } from '@/lib/categoryActivity';
import dbClient from '@/lib/dbClient';
import { whereActiveProduct } from '@/lib/prismaActiveScope';
import addCors from '@/pages/api/utils/addCors';
import { requireStaffBearerAuth } from '@/pages/api/utils/staffAuth';
import { RECOMMENDED_PRODUCTS_MAX } from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { Prisma } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

const filepath = 'src/pages/api/product/recommended.page.ts';

export interface RecommendedProductItem {
  id: string;
  slug: string;
  /** Raw multi-locale JSON name; the admin screen picks the locale. */
  name: string;
  imgUrl: string | null;
  isOutOfStock: boolean;
}

const putBodySchema = z.object({
  productIds: z
    .array(z.string().min(1).max(64))
    .max(RECOMMENDED_PRODUCTS_MAX)
    .refine((ids) => new Set(ids).size === ids.length, 'duplicateProduct'),
});

// Same order the storefront reads them in, so a tie (never written by this
// endpoint, but possible from a hand edit) ranks the same in both places.
const recommendedOrderBy = [
  { recommendedOrder: 'asc' as const },
  { createdAt: 'desc' as const },
];

async function listRecommended(): Promise<RecommendedProductItem[]> {
  const products = await dbClient.product.findMany({
    where: { ...whereActiveProduct, recommendedOrder: { not: null } },
    orderBy: recommendedOrderBy,
    select: {
      id: true,
      slug: true,
      name: true,
      imgUrls: true,
      outOfStockAt: true,
    },
  });
  return products.map(({ id, slug, name, imgUrls, outOfStockAt }) => ({
    id,
    slug,
    name,
    imgUrl: imgUrls[0] ?? null,
    isOutOfStock: outOfStockAt != null,
  }));
}

/** A pick that is no longer an active product; rolls the save back. */
class PickGoneError extends Error {}

type ProductLabel = { id: string; name: string };

/**
 * Writes the new order and returns the picks (`found`) plus the list as it
 * stood (`before`), both read under the save's locks. Null when a pick isn't
 * an active product.
 */
async function writeRecommended(
  productIds: string[],
): Promise<{ found: ProductLabel[]; before: ProductLabel[] } | null> {
  try {
    return await dbClient.$transaction(async (tx) => {
      // Saves run one at a time. Without this, two admins saving at once each
      // clear only the rows their snapshot saw and the lists merge.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('product:recommended'))`;

      // Row locks make a concurrent product delete wait for this commit, so
      // it clears the slot after us instead of us writing one back onto a
      // deleted product. Taken in id order so two writers can't deadlock.
      const found =
        productIds.length === 0
          ? []
          : await tx.$queryRaw<ProductLabel[]>`
              SELECT id, name FROM "Product"
              WHERE id IN (${Prisma.join(productIds)}) AND "deletedAt" IS NULL
              ORDER BY id
              FOR UPDATE`;
      if (found.length !== productIds.length) throw new PickGoneError();

      const before = await tx.product.findMany({
        where: { ...whereActiveProduct, recommendedOrder: { not: null } },
        orderBy: recommendedOrderBy,
        select: { id: true, name: true },
      });

      await tx.product.updateMany({
        where: { recommendedOrder: { not: null }, id: { notIn: productIds } },
        data: { recommendedOrder: null },
      });
      // One statement for the whole order. Stored values are rewritten to
      // 0..n-1 whenever they drift, so gaps left by a removal don't pile up;
      // rows already in place aren't touched.
      if (productIds.length > 0) {
        const positions = Prisma.join(
          productIds.map((id, index) => Prisma.sql`(${id}, ${index}::int)`),
        );
        await tx.$executeRaw`
          UPDATE "Product" AS p SET "recommendedOrder" = v.position
          FROM (VALUES ${positions}) AS v(id, position)
          WHERE p.id = v.id
            AND p."recommendedOrder" IS DISTINCT FROM v.position`;
      }
      return { found, before };
    });
  } catch (error) {
    if (error instanceof PickGoneError) return null;
    throw error;
  }
}

/**
 * Replaces the whole recommended list with `productIds`, in that order. One
 * call covers adding, removing and reordering, and a retry is harmless.
 * Returns null when an id isn't an active product.
 */
async function saveRecommended(
  productIds: string[],
  actorId: string | undefined,
): Promise<RecommendedProductItem[] | null> {
  const written = await writeRecommended(productIds);
  if (written == null) return null;
  const { found, before } = written;

  const foundById = new Map(found.map((product) => [product.id, product]));
  const rankBefore = new Map(before.map(({ id }, index) => [id, index]));

  // Positions are logged 1-based, the way the admin screen numbers them.
  const position = (rank: number | undefined) =>
    rank == null ? null : rank + 1;
  const activities: AdminActivityInput[] = [];
  productIds.forEach((id, index) => {
    const from = rankBefore.get(id);
    if (from === index) return;
    activities.push({
      userId: actorId,
      entity: 'PRODUCT',
      action: 'UPDATE',
      entityId: id,
      meta: {
        name: categoryLabel(foundById.get(id)?.name ?? ''),
        changes: {
          recommended: { from: position(from), to: position(index) },
        },
      },
    });
  });
  before
    .filter(({ id }) => !foundById.has(id))
    .forEach(({ id, name }) => {
      activities.push({
        userId: actorId,
        entity: 'PRODUCT',
        action: 'UPDATE',
        entityId: id,
        meta: {
          name: categoryLabel(name),
          changes: {
            recommended: { from: position(rankBefore.get(id)), to: null },
          },
        },
      });
    });
  if (activities.length > 0) logAdminActivities(activities);

  return listRecommended();
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
      return res
        .status(200)
        .json({ success: true, data: await listRecommended() });
    }

    const parsed = putBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message ?? 'Invalid body',
      });
    }
    const data = await saveRecommended(parsed.data.productIds, actor.userId);
    if (data == null) {
      return res
        .status(400)
        .json({ success: false, message: 'productNotFound' });
    }
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(filepath, error);
    return res.status(500).json({
      success: false,
      message: "Couldn't update recommended products",
    });
  }
}
