import { test, expect } from '@playwright/test';

import { E2E_CATALOG } from './fixtures/catalog-slugs';

test.describe('Product detail', () => {
  test('loads seeded product by slug', async ({ page }) => {
    await page.goto(`/product/${E2E_CATALOG.productSlug}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByText(E2E_CATALOG.productName, { exact: false }).first(),
    ).toBeVisible({ timeout: 60_000 });
  });
});
