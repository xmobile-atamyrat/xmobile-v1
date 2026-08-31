import dbClient from '@/lib/dbClient';
import { whereActiveProduct } from '@/lib/prismaActiveScope';
import addCors from '@/pages/api/utils/addCors';
import { requireStaffBearerAuth } from '@/pages/api/utils/staffAuth';
import { squareBracketRegex } from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { Prisma } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/product/admin-list.page.ts';

/**
 * Why a product has no base price to show.
 * - `noPrice` — nothing was ever set.
 * - `danglingRef` — it points at a "[priceId]" whose row is gone, so the
 *   storefront renders a spinner forever. Worse than `noPrice` and invisible
 *   without looking, which is the whole reason the overview surfaces it.
 */
export type BasePriceIssue = 'noPrice' | 'danglingRef';

export interface AdminProductListItem {
  id: string;
  name: string;
  categoryId: string;
  brandId: string | null;
  isOutOfStock: boolean;
  /** ISO timestamp; the overview's "recently edited" sorts on it. */
  updatedAt: string;
  /** Resolved base price in manat, or null when there is none to show. */
  basePriceTmt: string | null;
  basePriceIssue: BasePriceIssue | null;
}

/**
 * Turns a stored `Product.price` into what the overview column shows.
 *
 * The column is stringly-typed by history: it holds "[priceId]" for a catalog
 * reference, a bare literal for products that predate the catalog, or nothing
 * at all. Kept pure and separate from the query so the three cases can be
 * tested without a database.
 */
export function resolveBasePrice(
  rawPrice: string | null,
  pricesById: Map<string, string>,
): Pick<AdminProductListItem, 'basePriceTmt' | 'basePriceIssue'> {
  if (rawPrice == null || rawPrice.trim() === '') {
    return { basePriceTmt: null, basePriceIssue: 'noPrice' };
  }

  const priceId = rawPrice.match(squareBracketRegex)?.[1];
  if (priceId == null) {
    // A legacy literal is inline rather than a reference: nothing to look up,
    // and nothing broken, so it is shown as stored.
    return { basePriceTmt: rawPrice, basePriceIssue: null };
  }

  const priceInTmt = pricesById.get(priceId);
  if (priceInTmt == null) {
    return { basePriceTmt: null, basePriceIssue: 'danglingRef' };
  }
  return { basePriceTmt: priceInTmt, basePriceIssue: null };
}

// A deliberately thin product list for admin pickers and the products overview
// table. The main GET /api/product is paginated and resolves a price per row
// (an N+1), which makes it the wrong tool for "let me search every product by
// name". Base prices are resolved here in one extra query instead: the ids are
// collected from every row first, then looked up together.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);
  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }
  if (!(await requireStaffBearerAuth(req, res))) return undefined;

  try {
    const { searchKeyword, categoryId } = req.query;

    const where: Prisma.ProductWhereInput = { ...whereActiveProduct };
    if (searchKeyword != null && searchKeyword !== '') {
      where.name = {
        contains: searchKeyword as string,
        mode: 'insensitive',
      };
    }
    if (categoryId != null && categoryId !== '') {
      where.categoryId = categoryId as string;
    }

    const products = await dbClient.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        categoryId: true,
        brandId: true,
        isOutOfStock: true,
        updatedAt: true,
        price: true,
      },
      // Deliberately not ordered by name: it is a localized JSON blob, so the
      // database would sort by whichever locale key sits first inside each
      // string. The overview table sorts by the rendered name client-side,
      // where the active locale is known; this just needs to be stable.
      orderBy: { createdAt: 'desc' },
    });

    const referencedPriceIds = products
      .map(({ price }) => price?.match(squareBracketRegex)?.[1])
      .filter((id): id is string => id != null);

    const prices =
      referencedPriceIds.length > 0
        ? await dbClient.prices.findMany({
            where: { id: { in: [...new Set(referencedPriceIds)] } },
            select: { id: true, priceInTmt: true },
          })
        : [];
    const pricesById = new Map(
      prices.map(({ id, priceInTmt }) => [id, priceInTmt]),
    );

    const data: AdminProductListItem[] = products.map(
      ({
        id,
        name,
        categoryId: catId,
        brandId,
        isOutOfStock,
        updatedAt,
        price,
      }) => ({
        id,
        name,
        categoryId: catId,
        brandId,
        isOutOfStock,
        updatedAt: updatedAt.toISOString(),
        ...resolveBasePrice(price, pricesById),
      }),
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(filepath, error);
    return res
      .status(500)
      .json({ success: false, message: (error as Error).message });
  }
}
