import { expect, test } from '@playwright/test';

import { E2E_VARIANT_PRODUCT } from './fixtures/catalog-slugs';

test.describe('Product detail — variant selection', () => {
  test('loads the variant product detail page', async ({ page }) => {
    await page.goto(`/product/${E2E_VARIANT_PRODUCT.slug}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByText(E2E_VARIANT_PRODUCT.name, { exact: false }).first(),
    ).toBeVisible({ timeout: 60_000 });
  });

  test('shows the variant spec chip on the detail page', async ({ page }) => {
    await page.goto(`/product/${E2E_VARIANT_PRODUCT.slug}`, {
      waitUntil: 'domcontentloaded',
    });
    // The spec text is rendered as a clickable chip/button
    await expect(
      page.getByText(E2E_VARIANT_PRODUCT.specText, { exact: false }).first(),
    ).toBeVisible({ timeout: 60_000 });
  });

  test('selecting the variant chip does not crash the page', async ({
    page,
  }) => {
    await page.goto(`/product/${E2E_VARIANT_PRODUCT.slug}`, {
      waitUntil: 'domcontentloaded',
    });

    const chip = page
      .getByText(E2E_VARIANT_PRODUCT.specText, { exact: false })
      .first();
    await chip.waitFor({ state: 'visible', timeout: 60_000 });
    await chip.click();

    // Page should still be functional after click
    await expect(page).not.toHaveURL(/error/);
    await expect(
      page.getByText(E2E_VARIANT_PRODUCT.name, { exact: false }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('color chip for the seeded color becomes visible after selecting the variant', async ({
    page,
  }) => {
    await page.goto(`/product/${E2E_VARIANT_PRODUCT.slug}`, {
      waitUntil: 'domcontentloaded',
    });

    const chip = page
      .getByText(E2E_VARIANT_PRODUCT.specText, { exact: false })
      .first();
    await chip.waitFor({ state: 'visible', timeout: 60_000 });
    await chip.click();

    // The color chip renders the color name as visible text
    await expect(
      page.getByText(E2E_VARIANT_PRODUCT.colorName, { exact: false }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Add to Cart button is present after selecting a variant and color', async ({
    page,
  }) => {
    await page.goto(`/product/${E2E_VARIANT_PRODUCT.slug}`, {
      waitUntil: 'domcontentloaded',
    });

    // Select variant
    const chip = page
      .getByText(E2E_VARIANT_PRODUCT.specText, { exact: false })
      .first();
    await chip.waitFor({ state: 'visible', timeout: 60_000 });
    await chip.click();

    // Select color — the chip renders the color name as visible text
    const colorSwatch = page
      .getByText(E2E_VARIANT_PRODUCT.colorName, { exact: false })
      .first();
    await colorSwatch.waitFor({ state: 'visible', timeout: 10_000 });
    await colorSwatch.click();

    // Add to Cart should be enabled
    const addToCart = page.getByRole('button', { name: /cart|add/i }).first();
    await expect(addToCart).toBeVisible({ timeout: 10_000 });
  });
});
