import { test, expect } from '@playwright/test';

import { E2E_CATALOG } from './fixtures/catalog-slugs';

test.describe('Product category grid', () => {
  test('shows seeded product title', async ({ page }) => {
    await page.goto(`/product-category/${E2E_CATALOG.subSlug}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByText(E2E_CATALOG.productName, { exact: false }).first(),
    ).toBeVisible({ timeout: 60_000 });
  });
});
