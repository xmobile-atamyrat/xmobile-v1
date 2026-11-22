import { test, expect } from '@playwright/test';

import { E2E_ORIGIN } from './constants';
import { E2E_CATALOG } from './fixtures/catalog-slugs';

// Order: user's pick -> browser's language -> link's -> GeoIP (home) -> ru.
// The first three are production nginx's job (scripts/prod_scripts/nginx-locale-*, tested in
// tests/integration/nginx-locale-redirect.integration.test.ts). There is no
// nginx here, so this covers what Next does: GeoIP on home, and nothing else.
const productPath = `/product/${E2E_CATALOG.productSlug}`;
const listingPath = `/product-category/${E2E_CATALOG.subSlug}`;

test.describe('Language detection: Turkmen browser', () => {
  test.use({ locale: 'tk', extraHTTPHeaders: { 'x-real-ip': '8.8.8.8' } });

  test('home skips GeoIP, as nginx already placed them', async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`${E2E_ORIGIN}/$`));
    expect(res?.request().redirectedFrom()).toBeNull();
  });
});

test.describe('Language detection: Russian browser', () => {
  test('a plain link stays as it is', async ({ page }) => {
    const res = await page.goto(listingPath, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page).toHaveURL(new RegExp(`${E2E_ORIGIN}${listingPath}$`));
    expect(res?.request().redirectedFrom()).toBeNull();
  });
});

test.describe('Language detection: unsupported browser language', () => {
  // 8.8.8.8 is a US address: GeoIP answers English.
  test.use({ locale: 'de-DE', extraHTTPHeaders: { 'x-real-ip': '8.8.8.8' } });

  test('home falls back to GeoIP, on the server', async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`${E2E_ORIGIN}/en$`));
    expect((await res?.request().redirectedFrom()?.response())?.status()).toBe(
      307,
    );
  });

  test('a shared link keeps its own language', async ({ page }) => {
    await page.goto(`/en${productPath}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`/en${productPath}$`));
  });

  test('other pages keep the URL’s language', async ({ page }) => {
    await page.goto(listingPath, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`${E2E_ORIGIN}${listingPath}$`));
  });
});

test.describe('Language detection: crawlers', () => {
  test.use({
    locale: 'tk',
    userAgent:
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    extraHTTPHeaders: { 'x-real-ip': '8.8.8.8' },
  });

  [listingPath, '/', `/en${productPath}`].forEach((path) => {
    test(`get ${path} exactly as asked`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(res?.request().redirectedFrom()).toBeNull();
      expect(res?.url()).toBe(`${E2E_ORIGIN}${path}`);
    });
  });
});
