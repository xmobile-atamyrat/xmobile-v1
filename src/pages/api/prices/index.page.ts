// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import dbClient from '@/lib/dbClient';
import { syncProductOutOfStockFromPrices } from '@/lib/outOfStock';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ResponseApi } from '@/pages/lib/types';
import { Prices, Prisma } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/prices/index.page.ts';
const squareBracketRegex = /\[([^\]]+)\]/;

// A price belongs to at most one product, so connecting one that another
// product already owns has to be refused rather than silently stealing it —
// the previous owner's `price`/`tags` strings would keep pointing at a price
// that is no longer in its connected list. Returns an error message when the
// assignment is not allowed, or null when it is.
export function priceAssignmentError(
  current: { productId: string | null },
  requestedProductId: string | null,
): string | null {
  if (requestedProductId == null) return null; // disconnecting is always fine
  if (current.productId == null) return null; // unowned, free to claim
  if (current.productId === requestedProductId) return null; // no-op
  return 'This price is already connected to another product. Disconnect it there first.';
}

// Composable filters for GET. `productId` scopes to one product's connected
// prices, `unassigned` to prices no product owns yet (the connect-price
// search), `categoryId` to the product form's picker pool, and `searchKeyword`
// narrows whichever of those applies.
export function pricesWhere(query: {
  productId?: string;
  unassigned?: string;
  categoryId?: string;
  searchKeyword?: string;
}): Prisma.PricesWhereInput {
  const where: Prisma.PricesWhereInput = {};
  if (query.productId != null) {
    where.productId = query.productId;
  } else if (query.unassigned === 'true') {
    where.productId = null;
  }
  // Independent of the owner filters above: the picker wants every price in the
  // category, taken ones included, so it can show them greyed out with the
  // product holding them. Uncategorized prices come along too — a price with no
  // category belongs nowhere in particular, so it is fair game for any product
  // rather than stranded out of reach of every picker.
  //
  // Lives in `AND` rather than as a second `OR`: `searchKeyword` below owns the
  // top-level `OR`, and a `where` object only has room for one of them.
  if (query.categoryId != null && query.categoryId !== '') {
    where.AND = [
      { OR: [{ categoryId: query.categoryId }, { categoryId: null }] },
    ];
  }
  if (query.searchKeyword != null) {
    where.OR = [
      { name: { contains: query.searchKeyword, mode: 'insensitive' } },
      { price: { contains: query.searchKeyword, mode: 'insensitive' } },
      { priceInTmt: { contains: query.searchKeyword, mode: 'insensitive' } },
    ];
  }
  return where;
}

export async function getPrice(priceId: string): Promise<Prices | null> {
  if (priceId != null) {
    const priceMatch = priceId?.match(squareBracketRegex);
    if (priceMatch != null) {
      priceId = priceMatch[1];
    }

    const price = await dbClient.prices.findUnique({
      where: {
        id: priceId,
      },
    });

    return price;
  }

  console.warn(filepath, 'priceId is null');
  return null; // not to crash the website return null;
}

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseApi>) {
  addCors(res);
  const { method, userId } = req as AuthenticatedRequest;

  if (method !== 'GET') {
    const user = await dbClient.user.findUnique({ where: { id: userId } });
    if (user == null || !['SUPERUSER', 'ADMIN'].includes(user.grade)) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  }

  if (method === 'POST') {
    try {
      const body: Partial<Prices> = req.body;
      if (body == null) {
        return res.status(400).json({
          success: false,
          message: 'No data provided',
        });
      }

      const { name, price, priceInTmt, categoryId, productId } = body;
      if (name == null || price == null || priceInTmt == null) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
      }
      // A brand-new price has no owner yet, so it can always take the requested
      // product; an invalid id is caught by the foreign key.
      const newPrice = await dbClient.prices.create({
        data: {
          name,
          price,
          priceInTmt,
          categoryId: categoryId ?? null,
          productId: productId ?? null,
        },
      });

      // A new price starts in stock, so attaching one to an out-of-stock
      // product brings that product back — same rule as any other price edit.
      if (newPrice.productId != null) {
        await syncProductOutOfStockFromPrices(newPrice.productId);
      }

      return res.status(200).json({
        success: true,
        message: 'Prices updated',
        data: newPrice,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  } else if (method === 'GET') {
    try {
      const { id, searchKeyword, productId, unassigned, categoryId } =
        req.query;
      if (id != null) {
        const price = await getPrice(id as string);
        return res.status(200).json({ success: true, data: price });
      }

      const where = pricesWhere({
        productId: productId as string | undefined,
        unassigned: unassigned as string | undefined,
        categoryId: categoryId as string | undefined,
        searchKeyword: searchKeyword as string | undefined,
      });

      const prices = await dbClient.prices.findMany({
        where,
        // The owning product travels with each row so the price table can label
        // and grey out taken prices without a second round-trip.
        include: { product: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      });
      return res.status(200).json({ success: true, data: prices });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  } else if (method === 'PUT') {
    try {
      const { pricePairs }: { pricePairs: Partial<Prices>[] } = req.body;
      if (pricePairs == null) {
        return res.status(400).json({
          success: false,
          message: 'No data provided',
        });
      }

      // Every row's prior state, read once. Three things below need it: the
      // reassignment check, the out-of-stock transition, and working out which
      // products to re-derive afterwards. Validating up front also means a
      // rejected pair cannot leave earlier pairs half-applied.
      const current = await dbClient.prices.findMany({
        where: { id: { in: pricePairs.map((price) => price.id as string) } },
        select: { id: true, productId: true, isOutOfStock: true },
      });
      const currentById = new Map(current.map((price) => [price.id, price]));

      const missing = pricePairs.find(
        (price) => !currentById.has(price.id as string),
      );
      if (missing != null) {
        return res
          .status(404)
          .json({ success: false, message: `Price ${missing.id} not found` });
      }

      const rejected = pricePairs
        .filter((price) => 'productId' in price)
        .map((price) =>
          priceAssignmentError(
            currentById.get(price.id as string)!,
            price.productId ?? null,
          ),
        )
        .find((error) => error != null);
      if (rejected != null) {
        return res.status(409).json({ success: false, message: rejected });
      }

      await Promise.all(
        pricePairs.map(async (price) => {
          const data: any = { name: price.name };
          if (price.price != null) {
            data.price = price.price;

            // Sync with Product.cachedPrice
            const val = parseFloat(price.price);
            if (!Number.isNaN(val)) {
              await dbClient.product.updateMany({
                where: {
                  deletedAt: null,
                  OR: [
                    { price: price.id },
                    { price: { contains: `[${price.id}]` } },
                  ],
                },
                data: { cachedPrice: val },
              });
            }
          }
          if (price.priceInTmt != null) {
            data.priceInTmt = price.priceInTmt;
          }
          // Presence-keyed, not null-keyed: an explicit null clears the
          // category relation, which a `!= null` check would ignore.
          if ('categoryId' in price) {
            data.categoryId = price.categoryId ?? null;
          }
          // Same presence-keyed treatment: an explicit null disconnects the
          // price from its product.
          if ('productId' in price) {
            data.productId = price.productId ?? null;
          }
          // Only a real transition is written, so re-saving a price that is
          // already out of stock leaves `outOfStockAt` — the cleanup deadline —
          // where it was. Deliberately not cleared by an ordinary edit: the
          // currency job rewrites every price row, and doing so would silently
          // bring the whole catalog back in stock.
          if ('isOutOfStock' in price) {
            const wasOutOfStock = currentById.get(
              price.id as string,
            )!.isOutOfStock;
            const nowOutOfStock = price.isOutOfStock === true;
            if (nowOutOfStock !== wasOutOfStock) {
              data.isOutOfStock = nowOutOfStock;
              data.outOfStockAt = nowOutOfStock ? new Date() : null;
            }
          }
          const updatedPrice = await dbClient.prices.update({
            where: { id: price.id },
            data,
          });
          return updatedPrice;
        }),
      );

      // A price's stock state or ownership changing can change its product's
      // stock state, so the affected products are re-derived. Both the old and
      // the new owner are included: moving a price out of a product changes
      // what is left behind as much as what receives it. Pairs that only touch
      // name/price/category are skipped, keeping bulk price edits — the common
      // case — free of extra queries.
      const affectedProductIds = new Set<string>();
      pricePairs.forEach((price) => {
        if (!('isOutOfStock' in price) && !('productId' in price)) return;
        const previousProductId = currentById.get(
          price.id as string,
        )!.productId;
        if (previousProductId != null) {
          affectedProductIds.add(previousProductId);
        }
        if (price.productId != null) affectedProductIds.add(price.productId);
      });
      await Promise.all(
        [...affectedProductIds].map((affectedId) =>
          syncProductOutOfStockFromPrices(affectedId),
        ),
      );

      return res.status(200).json({
        success: true,
        message: 'Prices updated',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  } else if (method === 'DELETE') {
    try {
      const { id } = req.query;
      if (id == null) {
        return res.status(400).json({
          success: false,
          message: 'No product name provided',
        });
      }
      const deletedPrice = await dbClient.prices.delete({
        where: { id: id as string },
      });
      // Removing a price changes what its product's stock state is derived
      // from. Without this, deleting the last sold-out price of a product whose
      // remaining prices are in stock leaves the product marked out of stock —
      // with `outOfStockAt` still counting down toward the retention job — until
      // the nightly sync happens to run.
      if (deletedPrice.productId != null) {
        await syncProductOutOfStockFromPrices(deletedPrice.productId);
      }
      return res.status(200).json({
        success: true,
        message: 'Price deleted',
        data: deletedPrice,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}

export default withAuth(handler);
