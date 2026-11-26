/**
 * Seeded by {@link ../seed-e2e-stale-price.ts}; keep in sync with that file.
 */
export const E2E_STALE = {
  categoryId: '99999999-e2e0-4999-b999-999999999901',
  categorySlug: 'e2e-stale-category',
  priceId: '99999999-e2e0-4999-b999-999999999902',
  priceName: 'E2E Stale Price',
  productId: '99999999-e2e0-4999-b999-999999999903',
  productSlug: 'e2e-stale-phone',
  productName: 'E2E Stale Phone',
  /** Past the 90-day line, so the warning is the red one. */
  days: 100,
} as const;
