import { test, expect } from '@playwright/test';

test.describe('Cart (guest)', () => {
  test('cart route responds for unauthenticated users', async ({ page }) => {
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toMatch(/\/cart/);
  });
});
