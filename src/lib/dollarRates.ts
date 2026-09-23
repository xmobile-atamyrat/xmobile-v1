import { pricesFromUsd } from '@/pages/lib/priceDisplay';

// Structural rather than the Prisma types, so the client can pass the plain
// objects it fetched and the API can pass rows straight out of the database.
export interface RateLike {
  id: number;
  rate: number;
  isDefault: boolean;
}

export interface PriceRateRef {
  dollarRateId: number | null;
}

// The schema cannot express "exactly one default" (Prisma has no partial unique
// index), so the invariant lives in the rate API. Readers take the first flagged
// row and never assume one exists: a database seeded without rates has none.
export const findDefaultRate = <T extends RateLike>(rates: T[]): T | null =>
  rates.find((rate) => rate.isDefault) ?? null;

// Falls back to the default for both an unassigned price and a price pointing at
// a rate that is no longer there, so an orphaned row still prices at something
// sane instead of dropping out of the catalogue.
export const rateForPrice = <T extends RateLike>(
  price: PriceRateRef,
  rates: T[],
): T | null => {
  const assigned =
    price.dollarRateId == null
      ? undefined
      : rates.find((rate) => rate.id === price.dollarRateId);

  return assigned ?? findDefaultRate(rates);
};

// Null means "leave this row alone": legacy prices stored the string 'NaN', and
// recomputing those would write NaN over a real manat price.
export const recomputedPriceFields = (
  usdText: string,
  rate: number,
): { priceInTmt: string; displayPriceTmt: string } | null => {
  const usd = parseFloat(usdText);
  if (!Number.isFinite(usd)) return null;

  return pricesFromUsd(usd, rate);
};

// The where-clause for "every price this rate governs". The default rate also
// owns every unassigned price, so editing it has to sweep those up or they keep
// manat figures computed at the old number.
export const pricesAtRate = (rate: RateLike) =>
  rate.isDefault
    ? { OR: [{ dollarRateId: rate.id }, { dollarRateId: null }] }
    : { dollarRateId: rate.id };
