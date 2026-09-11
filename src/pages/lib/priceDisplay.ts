// Kept free of runtime imports: the order-creation path pulls this in, and its
// previous home (src/pages/product/utils.ts) imports papaparse and xlsx at
// module scope.

export const DISPLAY_PRICE_STEP = 10;

export const parsePrice = (price: string): number => {
  if (price == null) return 0;
  return parseFloat(parseFloat(price).toFixed(2));
};

// The single USD -> TMT rounding rule: prices are always whole manat, rounded
// up. The toFixed absorbs IEEE-754 error before the ceil — 50 * 19.6 is
// 980.0000000000001, which a bare Math.ceil would bill as 981.
export const tmtFromUsd = (usd: number, rate: number): number =>
  Math.ceil(parseFloat((usd * rate).toFixed(6)));

// Same toFixed guard as tmtFromUsd, for the same reason. ceil10(ceil1(x)) ===
// ceil10(x), so deriving this from an already-rounded priceInTmt matches
// deriving it from usd * rate, and re-running the rate recompute never walks a
// price upward.
export const roundToDisplayTmt = (tmt: number): number =>
  Math.ceil(parseFloat((tmt / DISPLAY_PRICE_STEP).toFixed(6))) *
  DISPLAY_PRICE_STEP;

export const displayTmtFromUsd = (usd: number, rate: number): number =>
  roundToDisplayTmt(tmtFromUsd(usd, rate));

// displayPriceTmt is required-and-nullable rather than optional on purpose: a
// Prisma `select` that forgets the column is then a type error instead of a
// silent fallback to the unrounded price.
export interface PriceRowLike {
  priceInTmt: string;
  displayPriceTmt: string | null;
}

// A stored zero counts as unset, not as a free product: priceInTmt already uses
// '0' as its default, and charging nothing is the one failure worth being
// paranoid about. Returns the stored string verbatim, so a pinned '1290.00'
// reaches the customer as the admin typed it.
export const displayPriceOf = (price: PriceRowLike): string => {
  const display = price.displayPriceTmt?.trim();
  if (!display) return price.priceInTmt;

  const parsed = Number(display);
  if (!Number.isFinite(parsed) || parsed <= 0) return price.priceInTmt;

  return display;
};

export const displayPriceOrNull = (
  price: PriceRowLike | null | undefined,
): string | null => (price == null ? null : displayPriceOf(price));

export const derivedDisplayFrom = (priceInTmt: string): string | null => {
  const tmt = parseFloat(priceInTmt);
  return Number.isFinite(tmt) ? roundToDisplayTmt(tmt).toString() : null;
};

// Null rather than 0, so a product with no usable price sorts last and matches
// no price range instead of leading every ascending list.
export const cachedPriceFrom = (
  price: PriceRowLike | null | undefined,
): number | null => {
  if (price == null) return null;
  const shown = parseFloat(displayPriceOf(price));
  return Number.isFinite(shown) ? shown : null;
};

// Every write path starting from dollars goes through this, so the pair cannot
// drift apart.
export const pricesFromUsd = (
  usd: number,
  rate: number,
): { priceInTmt: string; displayPriceTmt: string } => ({
  priceInTmt: tmtFromUsd(usd, rate).toString(),
  displayPriceTmt: displayTmtFromUsd(usd, rate).toString(),
});

// Stored to both columns unrounded: rounding over an explicitly typed figure
// would make the admin's own input a lie.
export const pricesPinned = (
  tmt: string,
): { priceInTmt: string; displayPriceTmt: string } => ({
  priceInTmt: tmt,
  displayPriceTmt: tmt,
});
