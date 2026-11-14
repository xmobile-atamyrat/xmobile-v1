import { test, expect } from '@playwright/test';

import { E2E_CATALOG, E2E_VARIANT_PRODUCT } from './fixtures/catalog-slugs';

// The suite runs in `ru`.
const RECOMMENDED_TITLE = 'Рекомендуемые товары';
const VIEW_ALL = 'Смотреть все';

test.describe('Home — recommended products', () => {
  test('shows the picks and opens the listing in their order', async ({
    page,
  }) => {
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
    await expect(page).toHaveURL(/\/product\?sortBy=recommended$/);

    // The pick leads even though the variant product is newer.
    const productLinks = page.locator('a[href*="/product/"]');
    await expect(
      page.locator(`a[href$="/${E2E_VARIANT_PRODUCT.slug}"]`).first(),
    ).toBeVisible({ timeout: 60_000 });
    const hrefs = await productLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href') ?? ''),
    );
    const pick = hrefs.findIndex((href) =>
      href.endsWith(`/${E2E_CATALOG.productSlug}`),
    );
    const newer = hrefs.findIndex((href) =>
      href.endsWith(`/${E2E_VARIANT_PRODUCT.slug}`),
    );
    expect(pick).toBeGreaterThanOrEqual(0);
    expect(pick).toBeLessThan(newer);
  });
});
