export const LISTING_RANK_MAX = 999999;

/**
 * Most products one save may renumber. A drag renumbers every row between the
 * two positions, so this has to cover a whole long category; Postgres' 65535
 * bind-parameter limit is the hard ceiling (the save binds about two per row).
 */
export const LISTING_RANK_MAX_CHANGES = 5000;

export interface RankedItem {
  id: string;
  listingRank: number;
}

export interface ListingRankChange {
  productId: string;
  listingRank: number | null;
}

export const byRank = <T extends RankedItem>(a: T, b: T) =>
  a.listingRank - b.listingRank;

/**
 * Moves one row and hands the list's existing numbers back out in the new
 * order, so a reorder never takes a number that another category holds.
 */
export function moveKeepingRanks<T extends RankedItem>(
  items: T[],
  from: number,
  to: number,
): T[] {
  if (from === to || to < 0 || to >= items.length) return items;
  const slots = items
    .map(({ listingRank }) => listingRank)
    .sort((a, b) => a - b);
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((item, index) => ({ ...item, listingRank: slots[index] }));
}

export function isValidListingRank(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= LISTING_RANK_MAX;
}

/**
 * The number "Add" gives a product: the server's `nextRank`, stepped past any
 * number this unsaved list already uses. Null when no valid number is left.
 */
export function rankForAdd(
  items: RankedItem[],
  nextRank: number | null,
): number | null {
  if (nextRank == null) return null;
  const used = new Set(items.map(({ listingRank }) => listingRank));
  let rank = nextRank;
  while (used.has(rank)) rank += 1;
  return isValidListingRank(rank) ? rank : null;
}

/**
 * After a save lost a race for numbers, moves the products added since the
 * last save (the ones that took numbers from `staleNextRank` up) along to
 * start at `freshNextRank`, keeping their order. Null when there is nothing
 * to move or the move would collide or run past the limit.
 */
export function shiftAddedRanks<T extends RankedItem>(
  items: T[],
  savedIds: ReadonlySet<string>,
  staleNextRank: number,
  freshNextRank: number,
): T[] | null {
  const offset = freshNextRank - staleNextRank;
  if (offset <= 0) return null;
  const isMoved = (item: T) =>
    !savedIds.has(item.id) && item.listingRank >= staleNextRank;
  if (!items.some(isMoved)) return null;
  const next = items.map((item) =>
    isMoved(item) ? { ...item, listingRank: item.listingRank + offset } : item,
  );
  const ranks = next.map(({ listingRank }) => listingRank);
  if (new Set(ranks).size !== ranks.length || !ranks.every(isValidListingRank))
    return null;
  return next.sort(byRank);
}

/** What a save has to send: every product whose number differs from `saved`. */
export function listingRankChanges(
  saved: RankedItem[],
  current: RankedItem[],
): ListingRankChange[] {
  const before = new Map(saved.map(({ id, listingRank }) => [id, listingRank]));
  const after = new Map(
    current.map(({ id, listingRank }) => [id, listingRank]),
  );
  const changes: ListingRankChange[] = [];
  after.forEach((listingRank, productId) => {
    if (before.get(productId) !== listingRank) {
      changes.push({ productId, listingRank });
    }
  });
  before.forEach((_, productId) => {
    if (!after.has(productId)) changes.push({ productId, listingRank: null });
  });
  return changes;
}
