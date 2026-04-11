import { test, expect } from '@playwright/test';

import { E2E_CATALOG } from './fixtures/catalog-slugs';

test.describe('Product slugs API', () => {
  test('includes seeded product slug', async ({ request }) => {
    const res = await request.get('/api/product/slugs');
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { success: boolean; data?: string[] };
    expect(body.success).toBe(true);
    expect(body.data).toContain(E2E_CATALOG.productSlug);
  });
});
