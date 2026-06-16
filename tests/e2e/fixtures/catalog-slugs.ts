/**
 * Seeded in {@link ../seed-e2e-catalog.ts}; keep in sync with that file.
 */
export const E2E_CATALOG = {
  rootName: 'E2E Root Category',
  subName: 'E2E Sub Category',
  productName: 'E2E Catalog Phone',
  rootSlug: 'e2e-root-catalog',
  subSlug: 'e2e-sub-catalog',
  productSlug: 'e2e-catalog-phone',
  rootUuid: '11111111-e2e0-4111-b111-111111111111',
  subUuid: '22222222-e2e0-4222-b222-222222222222',
  productUuid: '33333333-e2e0-4333-b333-333333333333',
} as const;

/**
 * Variant product seeded alongside E2E_CATALOG.
 * Has one color and one variant tag so e2e tests can exercise variant selection
 * and color filtering. Seeded in {@link ../seed-e2e-catalog.ts}.
 */
export const E2E_VARIANT_PRODUCT = {
  slug: 'e2e-variant-phone',
  uuid: '44444444-e2e0-4444-b444-444444444444',
  name: 'E2E Variant Phone',
  specText: '128gb',
  colorHex: '#cc0000',
  colorName: 'E2E Red',
  colorUuid: '55555555-e2e0-4555-b555-555555555555',
} as const;
