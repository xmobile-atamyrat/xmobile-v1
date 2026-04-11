import { test, expect } from '@playwright/test';

import { E2E_CATALOG } from './fixtures/catalog-slugs';

test.describe('Leaf category redirect', () => {
  test('browser ends on product-category for a leaf category slug', async ({
    page,
  }) => {
    await page.goto(`/category/${E2E_CATALOG.subSlug}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page).toHaveURL(
      new RegExp(`product-category\\/${E2E_CATALOG.subSlug}`),
      { timeout: 60_000 },
    );
  });
});
