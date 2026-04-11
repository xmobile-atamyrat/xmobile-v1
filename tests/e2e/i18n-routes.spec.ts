import { test, expect } from '@playwright/test';

import { E2E_CATALOG } from './fixtures/catalog-slugs';

test.describe('i18n route prefixes', () => {
  test('English locale category index loads', async ({ page }) => {
    await page.goto('/en/category', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/en/category');
  });

  test('seeded product-category works under /tk prefix', async ({ page }) => {
    await page.goto(`/tk/product-category/${E2E_CATALOG.subSlug}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByText(E2E_CATALOG.productName, { exact: false }).first(),
    ).toBeVisible({ timeout: 60_000 });
  });
});
