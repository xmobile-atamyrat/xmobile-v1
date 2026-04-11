import { test, expect } from '@playwright/test';

import { E2E_CATALOG } from './fixtures/catalog-slugs';

test.describe('Public API routes', () => {
  test('GET /api/category returns success with tree', async ({ request }) => {
    const res = await request.get('/api/category');
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      success: boolean;
      data?: unknown[];
    };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.data ?? []).length).toBeGreaterThan(0);
  });

  test('GET /api/category?categorySlug resolves seeded subcategory', async ({
    request,
  }) => {
    const res = await request.get(
      `/api/category?categorySlug=${E2E_CATALOG.subSlug}`,
    );
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      success: boolean;
      data?: { slug?: string };
    };
    expect(body.success).toBe(true);
    expect(body.data?.slug).toBe(E2E_CATALOG.subSlug);
  });
});
