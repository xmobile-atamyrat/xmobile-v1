import { expect, test } from '@playwright/test';

import { E2E_VARIANT_PRODUCT, E2E_CATALOG } from './fixtures/catalog-slugs';

test.describe('Color filter', () => {
  // ── API-level tests ────────────────────────────────────────────────────────

  test('GET /api/product?colorIds=<id> returns the seeded variant product', async ({
    request,
  }) => {
    const res = await request.get(
      `/api/product?colorIds=${E2E_VARIANT_PRODUCT.colorUuid}`,
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);

    const products: Array<{ id: string }> =
      body.data?.products ?? body.data ?? [];
    expect(products.some((p) => p.id === E2E_VARIANT_PRODUCT.uuid)).toBe(true);
  });

  test('GET /api/product?colorIds=<unknown> returns an empty product list', async ({
    request,
  }) => {
    const res = await request.get(
      '/api/product?colorIds=00000000-0000-4000-8000-000000000099',
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const products: Array<unknown> = body.data?.products ?? body.data ?? [];
    expect(products).toHaveLength(0);
  });

  test('GET /api/product/filters includes the seeded color UUID', async ({
    request,
  }) => {
    const res = await request.get('/api/product/filters');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.colors).toContain(E2E_VARIANT_PRODUCT.colorUuid);
  });

  // ── UI-level tests ─────────────────────────────────────────────────────────

  test('color filter section is visible on the category listing page', async ({
    page,
  }) => {
    await page.goto(`/category/${E2E_CATALOG.subSlug}`, {
      waitUntil: 'domcontentloaded',
    });

    // FilterSidebar renders after async fetches — wait for color swatch to appear
    await expect(
      page.locator(`[title="${E2E_VARIANT_PRODUCT.colorName}"]`).first(),
    ).toBeVisible({ timeout: 60_000 });
  });

  test('clicking a color filter checkbox updates the URL with colorIds', async ({
    page,
  }) => {
    await page.goto(`/category/${E2E_CATALOG.subSlug}`, {
      waitUntil: 'domcontentloaded',
    });

    const swatch = page
      .locator(`[title="${E2E_VARIANT_PRODUCT.colorName}"]`)
      .first();
    await swatch.waitFor({ state: 'visible', timeout: 60_000 });
    await swatch.click();

    await expect(page).toHaveURL(
      new RegExp(`colorIds=${E2E_VARIANT_PRODUCT.colorUuid}`),
      { timeout: 10_000 },
    );
  });
});
