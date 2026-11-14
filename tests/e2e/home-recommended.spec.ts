import { test, expect } from '@playwright/test';

import { E2E_CATALOG, E2E_VARIANT_PRODUCT } from './fixtures/catalog-slugs';

// The suite runs in `ru`.
const RECOMMENDED_TITLE = 'Рекомендуемые товары';
const VIEW_ALL = 'Смотреть все';

test.describe('Home — recommended products', () => {
  test('shows the picks and opens a listing of only them', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const section = page.locator('section', {
      has: page.getByRole('heading', { name: RECOMMENDED_TITLE }),
    });
    await expect(section).toBeVisible({ timeout: 60_000 });
    await expect(
      section.getByText(E2E_CATALOG.productName).first(),
    ).toBeVisible();
    await expect(section.getByText(E2E_VARIANT_PRODUCT.name)).toHaveCount(0);

    await section.getByRole('link', { name: VIEW_ALL }).click();
    await expect(page).toHaveURL(
      /\/product\?recommended=1&sortBy=recommended$/,
    );
    // Not getByRole: the notification prompt opens as a modal, which hides the
    // page behind it from the accessibility tree.
    await expect(
      page.locator('h1', { hasText: RECOMMENDED_TITLE }),
    ).toBeVisible();

    // The pick is listed; the variant product, not a pick, is not.
    await expect(
      page.locator(`a[href$="/${E2E_CATALOG.productSlug}"]`).first(),
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      page.locator(`a[href$="/${E2E_VARIANT_PRODUCT.slug}"]`),
    ).toHaveCount(0);
  });
});
