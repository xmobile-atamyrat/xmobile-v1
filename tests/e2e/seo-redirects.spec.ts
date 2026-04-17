import { test, expect } from '@playwright/test';

import { E2E_CATALOG } from './fixtures/catalog-slugs';

test.describe('SEO Redirections (Legacy ID to Slug)', () => {
  test('redirects from legacy category UUID to category slug', async ({
    page,
  }) => {
    // E2E_CATALOG provides real seed data containing fixed UUIDs
    await page.goto(`/category/${E2E_CATALOG.subUuid}`, {
      waitUntil: 'domcontentloaded',
    });

    // The Next.js server naturally issues a 308 permanent redirect pushing the browser.
    await expect(page).toHaveURL(
      new RegExp(`category\\/${E2E_CATALOG.subSlug}`),
      { timeout: 60_000 },
    );
  });

  test('redirects from legacy product UUID to product slug', async ({
    page,
  }) => {
    await page.goto(`/product/${E2E_CATALOG.productUuid}`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page).toHaveURL(
      new RegExp(`product\\/${E2E_CATALOG.productSlug}`),
      { timeout: 60_000 },
    );
  });

  test('redirects from product list index query param to isolated slug route', async ({
    page,
  }) => {
    // We pass the categoryId parameter mimicking search/filter bars
    await page.goto(`/product?categoryId=${E2E_CATALOG.subUuid}`, {
      waitUntil: 'domcontentloaded',
    });

    // It should transparently drop the param and redirect completely to product-category route
    await expect(page).toHaveURL(
      new RegExp(`product-category\\/${E2E_CATALOG.subSlug}`),
      { timeout: 60_000 },
    );
  });
});
