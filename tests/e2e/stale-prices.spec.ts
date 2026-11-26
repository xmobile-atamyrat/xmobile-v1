import { test, expect, type Page } from '@playwright/test';

import { E2E_STALE } from './fixtures/stale-price';
import { signInAs } from './helpers/auth';
import { removeE2eStalePrice, seedE2eStalePrice } from './seed-e2e-stale-price';

const attentionDot = (page: Page) =>
  page.getByRole('status', { name: 'Есть цены, которые пора обновить' });
const cardBadge = (page: Page) => page.getByTestId('stale-price-badge');

/** Opens the product's grid and waits for the staff-only warning list. */
async function openGrid(page: Page) {
  const staleList = page.waitForResponse((res) =>
    res.url().endsWith('/api/prices/stale'),
  );
  await page.goto(`/product-category/${E2E_STALE.categorySlug}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByText(E2E_STALE.productName).first()).toBeVisible({
    timeout: 60_000,
  });
  expect((await staleList).ok()).toBe(true);
}

test.describe('Stale price warnings', () => {
  test.beforeAll(seedE2eStalePrice);
  test.afterAll(removeE2eStalePrice);

  test('an admin confirms an old price and the warnings disappear', async ({
    page,
    context,
  }) => {
    // Three pages, each compiled on first visit by the dev server.
    test.setTimeout(180_000);
    await signInAs(context, 'superuser');

    await openGrid(page);
    await expect(attentionDot(page)).toBeVisible();
    await expect(cardBadge(page)).toContainText(String(E2E_STALE.days));

    await page.goto('/product/update-prices', {
      waitUntil: 'domcontentloaded',
    });
    const row = page.getByRole('row').filter({ hasText: E2E_STALE.priceName });
    await row
      .getByRole('button', { name: 'Отметить цену как актуальную' })
      .click({ timeout: 60_000 });
    const reread = page.waitForResponse((res) =>
      res.url().endsWith('/api/prices/stale'),
    );
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByText('Цены успешно обновлены!')).toBeVisible();
    expect((await reread).ok()).toBe(true);
    // Gone without a reload.
    await expect(attentionDot(page)).toHaveCount(0);

    await openGrid(page);
    await expect(attentionDot(page)).toHaveCount(0);
    await expect(cardBadge(page)).toHaveCount(0);
  });
});
