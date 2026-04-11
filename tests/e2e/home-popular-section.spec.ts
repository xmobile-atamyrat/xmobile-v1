import { test, expect } from '@playwright/test';

import { E2E_CATALOG } from './fixtures/catalog-slugs';

test.describe('Home — popular categories', () => {
  test('surfaces seeded popular root category', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByText(E2E_CATALOG.rootName, { exact: false }).first(),
    ).toBeVisible({ timeout: 60_000 });
  });
});
