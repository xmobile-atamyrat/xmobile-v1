// Decides whether a price write counts as an admin "re-checking" the price.
// Only a changed USD `price` or manat `priceInTmt` does; display-only edits,
// renames, category/rate moves and stock changes do not.

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
