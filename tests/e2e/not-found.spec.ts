import { test, expect } from '@playwright/test';

test.describe('Not found', () => {
  test('unknown product slug returns 404', async ({ request }) => {
    const res = await request.get(
      '/product/this-product-slug-should-not-exist-404',
    );
    expect(res.status()).toBe(404);
  });
});
