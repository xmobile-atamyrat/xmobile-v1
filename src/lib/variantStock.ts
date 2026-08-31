import dbClient from '@/lib/dbClient';

// The bracket syntax the product form writes into `price` and `tags`, and that
// cart items store verbatim in `selectedVariant`.
const squareBracketRegex = /\[([^\]]+)\]/;

/** The price a variant tag points at, or null for a tag without a reference. */
export function variantPriceId(tag: string | null | undefined): string | null {
  return tag?.match(squareBracketRegex)?.[1] ?? null;
}

/**
 * Of these variant tags, which ones cannot be ordered.
 *
 * Three things make a variant unavailable and all three belong in one answer:
 * the price it points at is sold out, that price no longer exists, or the tag
 * carries no price reference at all. The result is keyed by the tag rather than
 * by the price id because that last case has no id to key on.
 *
 * The query asks which referenced prices are *sellable*, not which are sold
 * out. A deleted price is absent from either result, so only this direction can
 * tell a missing row apart from an in-stock one — the sold-out query used to
 * wave a deleted price straight through the order guard.
 *
 * One query for the whole set rather than one per item: the cart and the order
 * guard both ask this about every line at once.
 */
export async function unavailableVariantTags(
  variantTags: (string | null | undefined)[],
): Promise<Set<string>> {
  const unavailable = new Set<string>();
  // Many tags can share one price (the same capacity in several colors), so
  // referenced ids are deduped for the query and fanned back out afterwards.
  const tagsByPriceId = new Map<string, string[]>();

  variantTags.forEach((tag) => {
    if (tag == null) return;
    const priceId = variantPriceId(tag);
    if (priceId == null) {
      unavailable.add(tag);
      return;
    }
    const sharing = tagsByPriceId.get(priceId);
    if (sharing == null) tagsByPriceId.set(priceId, [tag]);
    else sharing.push(tag);
  });

  if (tagsByPriceId.size === 0) return unavailable;

  const priceIds = [...tagsByPriceId.keys()];
  const sellable = await dbClient.prices.findMany({
    where: { id: { in: priceIds }, isOutOfStock: false },
    select: { id: true },
  });
  const sellableIds = new Set(sellable.map(({ id }) => id));

  priceIds.forEach((priceId) => {
    if (sellableIds.has(priceId)) return;
    tagsByPriceId.get(priceId)!.forEach((tag) => unavailable.add(tag));
  });

  return unavailable;
}
