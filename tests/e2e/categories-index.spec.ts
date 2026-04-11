import { test, expect } from '@playwright/test';

import { E2E_CATALOG } from './fixtures/catalog-slugs';

test.describe('Categories index (/category)', () => {
  test('shows seeded root category label', async ({ page }) => {
    await page.goto('/category', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByText(E2E_CATALOG.rootName, { exact: false }).first(),
    ).toBeVisible({ timeout: 60_000 });
  });
});
