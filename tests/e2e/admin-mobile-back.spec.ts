import { test, expect, type Page } from '@playwright/test';

import { signInAs } from './helpers/auth';

/**
 * Admin tools on a phone: the mobile Appbar renders nothing off the home
 * screen, so these pages opt into Layout's `mobileBackButton`. It must show,
 * sit clear of the page's content, and go where the desktop header's back
 * button goes.
 */

const MOBILE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
};

const PAGES: { path: string; back: string }[] = [
  { path: '/admin/analytics', back: '/user' },
  { path: '/admin/banners', back: '/user' },
  { path: '/admin/app-version', back: '/user' },
  { path: '/admin/push-retry-config', back: '/user' },
  { path: '/admin/recommended', back: '/user' },
  { path: '/admin/activity', back: '/user' },
  { path: '/product/bulk-edit', back: '/' },
  { path: '/product/overview', back: '/' },
  { path: '/product/price-list', back: '/' },
  { path: '/product/update-colors', back: '/' },
  { path: '/product/update-prices', back: '/' },
  { path: '/orders/admin', back: '/' },
  // An unknown order still renders its "not found" state inside Layout.
  {
    path: '/orders/admin/00000000-0000-4000-8000-00000000e2e0',
    back: '/orders/admin',
  },
  { path: '/server-logs', back: '/' },
];

/** Layout's mobile back button (the desktop header's is labelled "back"). */
const backButton = (page: Page) =>
  page.getByRole('button', { name: 'Назад', exact: true });

/** The button's bottom and the top of the page's first content box. */
const layoutGap = (page: Page) =>
  page.evaluate(() => {
    const button = document.querySelector('main > button[aria-label]');
    // Layout's content wrapper is the main's first div; its first child is
    // the page.
    const content = document.querySelector('main > div')?.firstElementChild;
    if (!button || !content) return null;
    return {
      buttonBottom: button.getBoundingClientRect().bottom,
      contentTop: content.getBoundingClientRect().top,
    };
  });

test.describe('Admin pages on a phone (390x844)', () => {
  test.use(MOBILE);

  test.beforeEach(async ({ context }) => {
    await signInAs(context, 'superuser');
    // Skip the one-second splash that covers the first page of a session.
    await context.addInitScript(() => {
      sessionStorage.setItem('hasShownSplash', 'true');
    });
  });

  PAGES.forEach(({ path, back }) => {
    test(`${path} has a back button to ${back}`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(backButton(page)).toBeVisible();

      // Some pages render their content only once the user has loaded.
      await expect
        .poll(() => layoutGap(page), {
          message: 'back button or page content not found',
        })
        .not.toBeNull();
      const gap = await layoutGap(page);
      expect(
        gap!.contentTop,
        'page content starts under the back button',
      ).toBeGreaterThanOrEqual(gap!.buttonBottom);

      await backButton(page).click();
      await expect(page).toHaveURL(
        (url) => url.pathname.replace(/\/$/, '') === back.replace(/\/$/, ''),
      );
    });
  });
});

test.describe('Admin pages on desktop', () => {
  test('keep the header back button and get no second one', async ({
    page,
    context,
  }) => {
    await signInAs(context, 'superuser');
    await page.goto('/admin/analytics', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('button', { name: 'back', exact: true }),
    ).toBeVisible();
    await expect(backButton(page)).toHaveCount(0);
  });
});
