import { test, expect, type Page } from '@playwright/test';

import { E2E_CATALOG } from './fixtures/catalog-slugs';
import { signInAs } from './helpers/auth';

/**
 * The tests share the seeded free user, so they run in order and each one
 * leaves that user with no favorites.
 */
test.describe.configure({ mode: 'serial' });

const MOBILE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
};

const productPath = `/product/${E2E_CATALOG.productSlug}`;
const addHeart = (page: Page) =>
  page.getByRole('button', { name: 'Добавить в избранное' });
const removeHeart = (page: Page) =>
  page.getByRole('button', { name: 'Удалить из избранного' });

/** Opens a page and waits for UserContext, which ignores taps until then. */
async function openSignedIn(page: Page, path: string) {
  const session = page.waitForResponse((res) =>
    res.url().endsWith('/api/user'),
  );
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await session;
}

async function tapAndSave(page: Page, heart: ReturnType<typeof addHeart>) {
  const saved = page.waitForResponse(
    (res) =>
      res.url().endsWith('/api/favorites') && res.request().method() !== 'GET',
  );
  await heart.click();
  expect((await saved).ok()).toBe(true);
}

test.describe('Favorites on desktop', () => {
  test('a favorite survives a reload, shows on the page, and can be removed', async ({
    page,
    context,
  }) => {
    await signInAs(context, 'free');
    await openSignedIn(page, productPath);

    await tapAndSave(page, addHeart(page));
    await expect(removeHeart(page)).toBeVisible();

    await openSignedIn(page, productPath);
    await expect(removeHeart(page)).toBeVisible();

    await page
      .getByRole('banner')
      .getByRole('button', { name: 'Избранное' })
      .click();
    await expect(page).toHaveURL(/\/favorites$/);
    await expect(page.getByText(E2E_CATALOG.productName)).toBeVisible();

    await tapAndSave(page, removeHeart(page));
    await expect(page.getByText(E2E_CATALOG.productName)).toHaveCount(0);
    await expect(page.getByText('В избранном пока ничего нет')).toBeVisible();

    await openSignedIn(page, '/favorites');
    await expect(page.getByText('В избранном пока ничего нет')).toBeVisible();
  });
});

test.describe('Favorites as a guest', () => {
  test('the heart leads to sign-in', async ({ page }) => {
    await page.goto(productPath, { waitUntil: 'domcontentloaded' });

    await addHeart(page).click();

    await expect(page).toHaveURL(/\/user\/signin$/);
  });

  test('the page asks to sign in', async ({ page }) => {
    await page.goto('/favorites', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByText('Войдите, чтобы увидеть избранное'),
    ).toBeVisible();
  });
});

test.describe('Favorites on a phone', () => {
  test.use(MOBILE);

  test('the bottom bar has favorites in place of search', async ({
    page,
    context,
  }) => {
    await signInAs(context, 'free');
    await openSignedIn(page, productPath);
    await tapAndSave(page, addHeart(page));

    const bar = page.getByRole('navigation').last();
    await expect(bar.getByRole('button', { name: 'Поиск' })).toHaveCount(0);
    await bar.getByRole('button', { name: 'Избранное' }).click();

    await expect(page).toHaveURL(/\/favorites$/);
    await expect(page.getByText(E2E_CATALOG.productName)).toBeVisible();

    await tapAndSave(page, removeHeart(page));
    await expect(page.getByText('В избранном пока ничего нет')).toBeVisible();
  });
});
