// Decides whether a price write counts as an admin "re-checking" the price.
// A changed USD `price` or manat `priceInTmt` does, and so does adding a sale or
// changing its amount; display-only edits, renames, category/rate moves, stock
// changes and ending a sale do not.
import { PriceRowLike, salePriceOf } from '@/pages/lib/priceDisplay';

type PriceAmounts = {
  price?: string | null;
  priceInTmt?: string | null;
};

function amountChanged(
  submitted: string | null | undefined,
  stored: string | null | undefined,
): boolean {
  if (submitted == null) return false;
  const next = String(submitted).trim();
  const prev = String(stored ?? '').trim();
  if (next === prev) return false;
  const nextNumber = Number(next);
  const prevNumber = Number(prev);
  if (
    next !== '' &&
    prev !== '' &&
    Number.isFinite(nextNumber) &&
    Number.isFinite(prevNumber) &&
    nextNumber === prevNumber
  ) {
    return false;
  }
  return true;
}

// `rateDerivedTmt` is the manat figure the row's newly chosen rate yields. The
// Update Prices page sends exactly that figure when an admin only switches the
// rate, which is a rate move rather than a re-checked price.
export function priceAmountsChanged(
  submitted: PriceAmounts,
  stored: PriceAmounts | null | undefined,
  rateDerivedTmt?: string | null,
): boolean {
  const tmtFromRate =
    rateDerivedTmt != null &&
    submitted.priceInTmt != null &&
    !amountChanged(submitted.priceInTmt, rateDerivedTmt);
  return (
    amountChanged(submitted.price, stored?.price) ||
    (!tmtFromRate && amountChanged(submitted.priceInTmt, stored?.priceInTmt))
  );
}

// True when the row ends up with an active sale it did not have before: a newly
// added one or a different amount. Removing a sale is not such a change.
export function saleSetOrChanged(
  before: PriceRowLike,
  after: PriceRowLike,
): boolean {
  const next = salePriceOf(after);
  if (next == null) return false;
  const prev = salePriceOf(before);
  return prev == null || Number(prev) !== Number(next);
}
