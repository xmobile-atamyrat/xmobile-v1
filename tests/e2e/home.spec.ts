import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('loads in the browser', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toMatch(/127\.0\.0\.1:\d+\/?$/);
  });
});
