// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import dbClient from '@/lib/dbClient';
import { rateForPrice, recomputedPriceFields } from '@/lib/dollarRates';
import {
  markProductsWithMissingPriceOutOfStock,
  productIdsWithPriceInTags,
  syncProductOutOfStockFromPrices,
} from '@/lib/outOfStock';
import {
  recordPriceCreated,
  recordPriceDeleted,
  recordPricesUpdated,
} from '@/lib/priceActivity';
import { revalidateInBackground } from '@/lib/revalidate';
import {
  productIdsReferencingPrices,
  productRevalidationPaths,
} from '@/lib/revalidateTargets';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import {
  priceAmountsChanged,
  saleSetOrChanged,
} from '@/pages/api/prices/priceCheckedAt';
import {
  cachedPriceFrom,
  derivedDisplayFrom,
  PriceRowLike,
  salePriceOf,
  ShownPriceRow,
} from '@/pages/lib/priceDisplay';
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

/**
 * Products whose cached pages a batch of price edits invalidates.
 *
 * Deliberately wider than the out-of-stock resync's `affectedProductIds`: that
 * set only tracks stock and ownership because those are the only things that
 * re-derive a product row. A plain amount change writes nothing to the product,
 * but it still moves the JSON-LD price on its detail page and the price in the
 * grid its category listing seeds. Old and new owner both count — moving a price
 * off a product changes what is left behind as much as what receives it.
 */
export function priceRevalidationProductIds(
  pricePairs: Partial<Prices>[],
  currentById: Map<string, { productId: string | null }>,
): string[] {
  const productIds = new Set<string>();
  pricePairs.forEach((price) => {
    const previousProductId = currentById.get(price.id as string)?.productId;
    if (previousProductId != null) productIds.add(previousProductId);
    if (price.productId != null) productIds.add(price.productId);
  });
  return [...productIds];
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
      {
        displayPriceTmt: { contains: query.searchKeyword, mode: 'insensitive' },
      },
    ];
  }
  return where;
}

/** Doubles as the i18n key the admin page shows. */
const SALE_PRICE_INVALID = 'salePriceInvalid';

// A sale price as sent by the client, ready to store: empty or null clears it.
// Whether the figure is acceptable is salePriceOf's call.
const requestedSalePrice = (value: unknown): string | null =>
  String(value ?? '').trim() || null;

// True when storing the row would store a sale price that is not an active sale:
// not a number above zero and below the row's shown price.
const hasInvalidSale = (row: PriceRowLike): boolean =>
  row.salePriceTmt != null && salePriceOf(row) == null;

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

      const {
        name,
        price,
        priceInTmt,
        displayPriceTmt,
        salePriceTmt,
        categoryId,
        productId,
        dollarRateId,
      } = body;
      if (name == null || price == null || priceInTmt == null) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
      }
      const priceFields = {
        priceInTmt,
        // Derived, not pinned to priceInTmt: that is the exact conversion,
        // so a new price would reach the storefront unrounded.
        displayPriceTmt:
          displayPriceTmt ?? derivedDisplayFrom(priceInTmt) ?? priceInTmt,
        salePriceTmt: requestedSalePrice(salePriceTmt),
      };
      if (hasInvalidSale(priceFields)) {
        return res
          .status(400)
          .json({ success: false, message: SALE_PRICE_INVALID });
      }
      // A brand-new price has no owner yet, so it can always take the requested
      // product; an invalid id is caught by the foreign key.
      const newPrice = await dbClient.prices.create({
        data: {
          name,
          price,
          ...priceFields,
          categoryId: categoryId ?? null,
          dollarRateId: dollarRateId ?? null,
          productId: productId ?? null,
        },
      });

      recordPriceCreated(userId, newPrice).catch(() => undefined);

      // A new price starts in stock, so attaching one to an out-of-stock
      // product brings that product back — same rule as any other price edit.
      if (newPrice.productId != null) {
        await syncProductOutOfStockFromPrices(newPrice.productId);
        revalidateInBackground(res, () =>
          productRevalidationPaths([newPrice.productId]),
        );
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
      const {
        pricePairs,
      }: { pricePairs: (Partial<Prices> & { markChecked?: boolean })[] } =
        req.body;
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
        select: {
          id: true,
          name: true,
          productId: true,
          categoryId: true,
          outOfStockAt: true,
          price: true,
          priceInTmt: true,
          displayPriceTmt: true,
          salePriceTmt: true,
          dollarRateId: true,
          priceCheckedAt: true,
        },
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

      // Only read when a pair actually moves rate, which most saves do not.
      const rates = pricePairs.some((price) => 'dollarRateId' in price)
        ? await dbClient.dollarRate.findMany({ where: { currency: 'TMT' } })
        : [];

      // Each pair's money fields are worked out before anything is written, so a
      // sale price can be checked against what the row will show after this save
      // and a rejected one leaves the whole batch unapplied.
      const planned = pricePairs.map((price) => {
        const before = currentById.get(price.id as string)!;
        const data: any = { name: price.name };
        if (price.price != null) {
          data.price = price.price;
        }
        if (price.priceInTmt != null) {
          data.priceInTmt = price.priceInTmt;
        }
        // Only an edited USD/manat amount counts as the admin re-checking the
        // price. Decided from the submitted figures, before the rate-driven
        // repricing below fills priceInTmt itself. A manat figure that just
        // follows a newly chosen rate is a rate move and does not count.
        let rateDerivedTmt: string | null = null;
        if ('dollarRateId' in price) {
          const target = rateForPrice(
            { dollarRateId: price.dollarRateId ?? null },
            rates,
          );
          const derived =
            target == null
              ? null
              : recomputedPriceFields(data.price ?? before.price, target.rate);
          rateDerivedTmt = derived == null ? null : String(derived.priceInTmt);
        }
        // Presence-keyed rather than inferred from priceInTmt: the shown
        // price is an attribute an admin can pin away from the exact
        // conversion, so an edit to one must not rewrite the other.
        if ('displayPriceTmt' in price) {
          data.displayPriceTmt = price.displayPriceTmt ?? null;
        }

        // Presence-keyed: clearing the rate drops the price onto the
        // default, which is what prices it from then on. The manat figures
        // are re-derived here rather than trusted from the client, so the
        // stored price always matches the rate it is filed under.
        if ('dollarRateId' in price) {
          data.dollarRateId = price.dollarRateId ?? null;
          const target = rateForPrice(
            { dollarRateId: data.dollarRateId },
            rates,
          );
          if (target != null && data.priceInTmt == null) {
            const repriced = recomputedPriceFields(
              data.price ?? before.price,
              target.rate,
            );
            if (repriced != null) {
              data.priceInTmt = repriced.priceInTmt;
              // A display price typed in the same save is a deliberate pin
              // and outranks the figure the rate would derive.
              if (!('displayPriceTmt' in data)) {
                data.displayPriceTmt = repriced.displayPriceTmt;
              }
            }
          }
        }

        // Presence-keyed too: a save that leaves the sale alone must neither
        // clear it nor be refused because the stored one no longer applies.
        if ('salePriceTmt' in price) {
          data.salePriceTmt = requestedSalePrice(price.salePriceTmt);
        }

        // The row's price columns as they will be once this pair is applied.
        const after: ShownPriceRow = {
          priceInTmt: data.priceInTmt ?? before.priceInTmt,
          displayPriceTmt:
            'displayPriceTmt' in data
              ? data.displayPriceTmt
              : before.displayPriceTmt,
          salePriceTmt:
            'salePriceTmt' in data ? data.salePriceTmt : before.salePriceTmt,
          // Only whether it is set matters here; the timestamp that gets
          // stored is decided with the write below.
          outOfStockAt: before.outOfStockAt,
        };
        if ('isOutOfStock' in price) {
          after.outOfStockAt = price.isOutOfStock === true ? new Date() : null;
        }

        // `markChecked` is the page's refresh icon: the admin confirms the
        // price as still correct without changing it. A save that does not
        // send the sale cannot set one, even if it revives a stored sale.
        if (
          price.markChecked === true ||
          priceAmountsChanged(data, before, rateDerivedTmt) ||
          ('salePriceTmt' in data && saleSetOrChanged(before, after))
        ) {
          data.priceCheckedAt = new Date();
        }

        return { price, data, after };
      });

      if (
        planned.some(
          ({ data, after }) => 'salePriceTmt' in data && hasInvalidSale(after),
        )
      ) {
        return res
          .status(400)
          .json({ success: false, message: SALE_PRICE_INVALID });
      }

      const updatedPrices = await Promise.all(
        planned.map(async ({ price, data, after }) => {
          if (
            data.priceInTmt != null ||
            'displayPriceTmt' in data ||
            'salePriceTmt' in data ||
            // A sale only shows while its row is in stock.
            ('isOutOfStock' in price && after.salePriceTmt != null)
          ) {
            const shown = cachedPriceFrom(after);
            if (shown != null) {
              await dbClient.product.updateMany({
                where: {
                  deletedAt: null,
                  OR: [
                    { price: price.id },
                    { price: { contains: `[${price.id}]` } },
                  ],
                },
                data: { cachedPrice: shown },
              });
            }
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
            const wasOutOfStock =
              currentById.get(price.id as string)!.outOfStockAt != null;
            const nowOutOfStock = price.isOutOfStock === true;
            if (nowOutOfStock !== wasOutOfStock) {
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

      recordPricesUpdated(
        userId,
        updatedPrices.map((after) => ({
          before: currentById.get(after.id)!,
          after,
        })),
      ).catch(() => undefined);

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

      // Two sources, because a price reaches its product two ways. The FK side
      // has to come from `currentById` — the pre-update read — so a pair that
      // disconnects a price still rebuilds the owner it just left. The string
      // side is resolved live, and is the only link for a price whose FK was
      // never backfilled.
      //
      // Bulk edits from /product/price-list overshoot the batch cap and are
      // skipped inside revalidateInBackground, which is intended for them.
      //
      // A pair that only marks the price as checked changes nothing a customer
      // sees, so it rebuilds no pages.
      const shownPairs = pricePairs.filter((price) =>
        Object.keys(price).some((key) => key !== 'id' && key !== 'markChecked'),
      );
      const priceIds = shownPairs.map((price) => price.id as string);
      // A variant's sale also shows on cached pages (the sale badge), so the
      // products carrying such a price in a tag are rebuilt too.
      const salePriceIds = updatedPrices
        .filter(
          ({ id, salePriceTmt }) =>
            priceIds.includes(id) &&
            (salePriceTmt != null || currentById.get(id)!.salePriceTmt != null),
        )
        .map(({ id }) => id);
      revalidateInBackground(res, async () =>
        productRevalidationPaths([
          ...priceRevalidationProductIds(shownPairs, currentById),
          ...(await productIdsReferencingPrices(priceIds)),
          ...(await productIdsWithPriceInTags(salePriceIds)),
        ]),
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
      recordPriceDeleted(userId, deletedPrice);
      if (deletedPrice.productId != null) {
        await syncProductOutOfStockFromPrices(deletedPrice.productId);
      }
      // Runs whether or not the FK was set: a product's `price` string still
      // carries the bracket reference after the row is gone, which is exactly
      // the dangling state its cached page needs to be rebuilt out of.
      const affectedProductIds = [
        deletedPrice.productId,
        ...(await productIdsReferencingPrices([deletedPrice.id])),
      ];
      // Those same products now show "sold out" on the card, so the stored flag
      // (read by the In stock filter) must follow. Runs after the sync above so
      // the card rule wins, as it does in the daily batch. The price row is
      // already gone at this point, so a failure here must not turn the
      // response into a 500 or skip revalidation; the nightly sync catches up.
      // Products that only reference the row through a variant tag are checked
      // too: their link to it may be unset, so the lookups above miss them.
      try {
        await markProductsWithMissingPriceOutOfStock([
          ...affectedProductIds,
          ...(await productIdsWithPriceInTags([deletedPrice.id])),
        ]);
      } catch (error) {
        console.error(
          `${filepath}: failed to mark products out of stock after price delete`,
          error,
        );
      }
      revalidateInBackground(res, async () =>
        productRevalidationPaths([
          ...affectedProductIds,
          // A deleted sale also shows on pages of products that only carry
          // the price in a variant tag.
          ...(deletedPrice.salePriceTmt != null
            ? await productIdsWithPriceInTags([deletedPrice.id])
            : []),
        ]),
      );
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
