import { test, expect } from '@playwright/test';

import { E2E_CATALOG } from './fixtures/catalog-slugs';

test.describe('HTTP health (no JS)', () => {
  test('home responds without 5xx', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBeLessThan(500);
  });

  test('category index responds without 5xx', async ({ request }) => {
    const res = await request.get('/category');
    expect(res.status()).toBeLessThan(500);
  });

  test('seeded product-category page responds without 5xx', async ({
    request,
  }) => {
    const res = await request.get(`/product-category/${E2E_CATALOG.subSlug}`);
    expect(res.status()).toBeLessThan(500);
  });

  test('seeded category parent responds without 5xx', async ({ request }) => {
    const res = await request.get(`/category/${E2E_CATALOG.rootSlug}`);
    expect(res.status()).toBeLessThan(500);
  });
});
