import type { PriceSnapshot } from '@/lib/priceActivity';
import { squareBracketRegex } from '@/pages/lib/constants';
import type { Prisma } from '@prisma/client';

/**
 * A product reaches its prices two ways: by reference, through the ids written
 * into `Product.price` and `Product.tags`, and by ownership, through
 * `Prices.productId`. The references are what the storefront reads; ownership
 * is what the product form's picker greys out as "taken" and what the
 * out-of-stock rule derives from.
 *
 * Ownership follows the variant tags, recomputed whenever a product's `price`
 * or `tags` are saved (see `ownedPriceIds` for which references count):
 *
 * - a price the product owns but no longer claims is released, so a wrong pick
 *   that was removed again stops blocking every other product;
 * - a price it claims and nobody owns is claimed;
 * - a price it newly claims that another product owns is a conflict, and the
 *   whole save is refused.
 *
 * A price that was already claimed before the save but is owned elsewhere is
 * left alone rather than refused. Products that shared a price before
 * ownership existed still carry such references, and failing every later save
 * of theirs — a rename, a new photo — over a choice made long ago would make
 * them uneditable.
 */

/** The i18n key the product form shows when a save is refused. */
export const PRICE_TAKEN_MESSAGE = 'priceTakenByAnotherProduct';

export class PriceLinkConflictError extends Error {
  constructor() {
    super(PRICE_TAKEN_MESSAGE);
    this.name = 'PriceLinkConflictError';
  }
}

/**
 * The price ids a product owns: the ones its variant tags carry, or its base
 * price when no tag carries one.
 *
 * The base price usually repeats one of the variant prices as the "from" figure
 * on product cards, so it never counts alongside them. Otherwise removing a
 * price from a tag would keep it owned through the base price, still blocking
 * the product it was meant for.
 *
 * The product form writes the base price as "[priceId]", but older rows hold
 * the bare id, which `getPrice` and the cachedPrice sync both still accept. A
 * legacy literal such as "1200" comes through as a candidate too; it matches
 * no price row, so it never claims or protects anything.
 */
export function ownedPriceIds(
  price: string | null | undefined,
  tags: string[],
): string[] {
  const tagIds = new Set<string>();
  tags.forEach((tag) => {
    const priceId = tag.match(squareBracketRegex)?.[1];
    if (priceId) tagIds.add(priceId);
  });
  if (tagIds.size > 0) return [...tagIds];
  const baseId = price?.match(squareBracketRegex)?.[1] ?? (price || undefined);
  return baseId ? [baseId] : [];
}

export interface PriceLinkPlan {
  claim: string[];
  release: string[];
  conflicts: string[];
}

/**
 * The pure half of the rule above. `rows` must hold every price in `nextIds`
 * that exists plus every price `productId` currently owns; `productId` is null
 * for a product that has not been created yet and so owns nothing.
 */
export function planPriceLinks({
  productId,
  previousIds,
  nextIds,
  rows,
}: {
  productId: string | null;
  previousIds: string[];
  nextIds: string[];
  rows: { id: string; productId: string | null }[];
}): PriceLinkPlan {
  const previous = new Set(previousIds);
  const next = new Set(nextIds);
  const plan: PriceLinkPlan = { claim: [], release: [], conflicts: [] };
  rows.forEach((row) => {
    if (!next.has(row.id)) {
      if (productId != null && row.productId === productId) {
        plan.release.push(row.id);
      }
    } else if (row.productId == null) {
      plan.claim.push(row.id);
    } else if (row.productId !== productId && !previous.has(row.id)) {
      plan.conflicts.push(row.id);
    }
  });
  return plan;
}

const snapshotSelect = {
  id: true,
  name: true,
  price: true,
  priceInTmt: true,
  displayPriceTmt: true,
  productId: true,
  categoryId: true,
  dollarRateId: true,
  outOfStockAt: true,
} satisfies Prisma.PricesSelect;

async function loadPriceLinks(
  db: Prisma.TransactionClient,
  productId: string | null,
  previousIds: string[],
  nextIds: string[],
): Promise<{ plan: PriceLinkPlan; rows: PriceSnapshot[] }> {
  const rows = await db.prices.findMany({
    where: {
      OR: [
        { id: { in: nextIds } },
        // Guarded: `productId: null` here would match every unowned price.
        ...(productId != null ? [{ productId }] : []),
      ],
    },
    select: snapshotSelect,
  });
  return {
    plan: planPriceLinks({ productId, previousIds, nextIds, rows }),
    rows,
  };
}

/**
 * Read-only check for a save that would be refused, so the caller can turn it
 * away before doing anything it cannot undo, such as deleting image files.
 */
export async function hasPriceLinkConflict(
  db: Prisma.TransactionClient,
  productId: string | null,
  previousIds: string[],
  nextIds: string[],
): Promise<boolean> {
  const { plan } = await loadPriceLinks(db, productId, previousIds, nextIds);
  return plan.conflicts.length > 0;
}

/**
 * Applies the rule above. Meant to run in the same transaction as the product
 * write, so a refused save leaves neither side changed. Throws
 * `PriceLinkConflictError` on a conflict, including one that only appeared
 * after `hasPriceLinkConflict` was asked: the claim is guarded on the price
 * still being unowned, and a short count means another save got there first.
 *
 * Returns each price whose owner moved, for the activity log.
 */
export async function reconcileProductPriceLinks(
  db: Prisma.TransactionClient,
  productId: string,
  previousIds: string[],
  nextIds: string[],
): Promise<{ before: PriceSnapshot; after: PriceSnapshot }[]> {
  const { plan, rows } = await loadPriceLinks(
    db,
    productId,
    previousIds,
    nextIds,
  );
  if (plan.conflicts.length > 0) throw new PriceLinkConflictError();

  if (plan.release.length > 0) {
    await db.prices.updateMany({
      where: { id: { in: plan.release }, productId },
      data: { productId: null },
    });
  }
  if (plan.claim.length > 0) {
    const { count } = await db.prices.updateMany({
      where: { id: { in: plan.claim }, productId: null },
      data: { productId },
    });
    if (count !== plan.claim.length) throw new PriceLinkConflictError();
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  return [
    ...plan.release.map((id) => ({ id, owner: null })),
    ...plan.claim.map((id) => ({ id, owner: productId })),
  ].map(({ id, owner }) => {
    const before = byId.get(id)!;
    return { before, after: { ...before, productId: owner } };
  });
}
