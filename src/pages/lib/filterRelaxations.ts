// When a filter set matches nothing, the listing suggests dropping one filter
// and says how many products that would bring back. Price is never offered:
// it's the customer's budget, not a choice to talk them out of.

export const FILTER_DIMENSIONS = ['brands', 'colors', 'inStock'] as const;

export type FilterDimension = (typeof FILTER_DIMENSIONS)[number];

/** Products each dimension's removal would show; only active ones appear. */
export type FilterRelaxations = Partial<Record<FilterDimension, number>>;
