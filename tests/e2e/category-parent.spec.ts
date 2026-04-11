import { test, expect } from '@playwright/test';

import { E2E_CATALOG } from './fixtures/catalog-slugs';

test.describe('Parent category page', () => {
  test('lists seeded subcategory', async ({ page }) => {
    await page.goto(`/category/${E2E_CATALOG.rootSlug}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByText(E2E_CATALOG.subName, { exact: false }).first(),
    ).toBeVisible({ timeout: 60_000 });
  });

  test('navigates from parent to leaf (slug in URL)', async ({ page }) => {
    await page.goto(`/category/${E2E_CATALOG.rootSlug}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByText(E2E_CATALOG.subName, { exact: false }).first().click();
    await expect(page).toHaveURL(
      new RegExp(`product-category\\/${E2E_CATALOG.subSlug}`),
      { timeout: 60_000 },
    );
  });
});
