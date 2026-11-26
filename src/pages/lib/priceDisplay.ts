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

// displayPriceTmt and salePriceTmt are required-and-nullable rather than
// optional on purpose: a Prisma `select` that forgets a column is then a type
// error instead of a silent fallback to a different price.
export interface PriceRowLike {
  priceInTmt: string;
  displayPriceTmt: string | null;
  salePriceTmt: string | null;
}

// What deciding the shown price needs: a sold-out row's sale is not on offer.
// Required for the same reason as the columns above.
export interface ShownPriceRow extends PriceRowLike {
  outOfStockAt: Date | string | null;
}

// The normal price, ignoring any sale. A stored zero counts as unset, not as a
// free product: priceInTmt already uses '0' as its default, and charging nothing
// is the one failure worth being paranoid about. Returns the stored string
// verbatim, so a pinned '1290.00' reaches the customer as the admin typed it.
export const regularPriceOf = (
  price: Pick<PriceRowLike, 'priceInTmt' | 'displayPriceTmt'>,
): string => {
  const display = price.displayPriceTmt?.trim();
  if (!display) return price.priceInTmt;

  const parsed = Number(display);
  if (!Number.isFinite(parsed) || parsed <= 0) return price.priceInTmt;

  return display;
};

// Digits with an optional fraction, nothing else. The SQL in
// scripts/backfill_prices.sql applies the same pattern.
const PLAIN_AMOUNT = /^[0-9]+(\.[0-9]+)?$/;

// The sale price when it is active: a number above zero and strictly below the
// regular price. Anything else, including a sale the regular price has since
// dropped under, is no sale. The stored value is kept either way, so it becomes
// active again if the regular price goes back up.
export const salePriceOf = (price: PriceRowLike): string | null => {
  const sale = price.salePriceTmt?.trim();
  if (!sale || !PLAIN_AMOUNT.test(sale)) return null;

  const amount = Number(sale);
  if (!(amount > 0 && amount < Number(regularPriceOf(price)))) return null;

  return sale;
};

// Whole percent off, rounded down and kept within 1..99, so an active sale
// always has a badge to show. The toFixed is the same IEEE-754 guard as in
// tmtFromUsd: 29 off 100 must not floor to 28.
export const salePercentOf = (price: PriceRowLike): number | null => {
  const sale = salePriceOf(price);
  if (sale == null) return null;

  const regular = Number(regularPriceOf(price));
  const percent = Math.floor(
    parseFloat((((regular - Number(sale)) / regular) * 100).toFixed(6)),
  );
  return Math.min(99, Math.max(1, percent));
};

// What the customer pays: the sale price while one is active and the row is in
// stock, else the regular price.
export const displayPriceOf = (price: ShownPriceRow): string =>
  (price.outOfStockAt == null ? salePriceOf(price) : null) ??
  regularPriceOf(price);

export const displayPriceOrNull = (
  price: ShownPriceRow | null | undefined,
): string | null => (price == null ? null : displayPriceOf(price));

export const derivedDisplayFrom = (priceInTmt: string): string | null => {
  const tmt = parseFloat(priceInTmt);
  return Number.isFinite(tmt) ? roundToDisplayTmt(tmt).toString() : null;
};

// Null rather than 0, so a product with no usable price sorts last and matches
// no price range instead of leading every ascending list.
export const cachedPriceFrom = (
  price: ShownPriceRow | null | undefined,
): number | null => {
  if (price == null) return null;
  const shown = parseFloat(displayPriceOf(price));
  return Number.isFinite(shown) ? shown : null;
};

// Every write path starting from dollars goes through this, so the pair cannot
// drift apart. The sale price is not part of the pair: a rate change keeps it.
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
