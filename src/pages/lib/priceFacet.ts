// The price section of the filter rail: the real range of the listing and a
// few quick ranges cut where its prices actually sit, so phones and cables
// each get brackets that make sense for them.

export interface PriceBucket {
  /** Null: no lower bound. */
  min: number | null;
  /** Null: no upper bound. */
  max: number | null;
  count: number;
}

export interface PriceFacet {
  min: number;
  max: number;
  buckets: PriceBucket[];
}

// Two significant figures, so a break reads 1 200 or 19 000, never 18 743.
// Shown prices are whole tens of manat, so nothing rounds below 10.
export const roundNice = (value: number): number => {
  if (value < 100) return Math.max(10, Math.round(value / 10) * 10);
  const unit = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.round(value / unit) * unit;
};

const inBucket = (price: number, { min, max }: Omit<PriceBucket, 'count'>) =>
  (min == null || price >= min) && (max == null || price <= max);

/** Null when nothing in the listing has a price. */
export function priceFacet(prices: number[]): PriceFacet | null {
  const sorted = prices
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  // Quartiles split the listing into brackets of roughly equal size.
  const breaks = [
    ...new Set(
      [0.25, 0.5, 0.75].map((q) =>
        roundNice(sorted[Math.floor(sorted.length * q)]),
      ),
    ),
  ].filter((b) => b > min && b < max);
  if (sorted.length < 4 || breaks.length === 0) {
    return { min, max, buckets: [] };
  }

  const edges = [null, ...breaks, null];
  const buckets = edges.slice(0, -1).map((lower, i) => {
    const bounds = { min: lower, max: edges[i + 1] };
    return {
      ...bounds,
      count: sorted.filter((price) => inBucket(price, bounds)).length,
    };
  });
  return { min, max, buckets };
}

/** 12500 -> "12 500". */
export const formatTmt = (value: number): string =>
  String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** "0 – 3 000", "3 000 – 7 000" or "15 000+": the same in every language. */
export const priceRangeLabel = (
  min: number | null,
  max: number | null,
): string => {
  if (max == null) return `${formatTmt(min ?? 0)}+`;
  return `${formatTmt(min ?? 0)} – ${formatTmt(max)}`;
};
