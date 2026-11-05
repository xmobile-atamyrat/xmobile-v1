import {
  test,
  expect,
  type Download,
  type Locator,
  type Page,
} from '@playwright/test';
import ExcelJS from 'exceljs';

import { E2E_PROCUREMENT } from './fixtures/procurement';
import { signInAs } from './helpers/auth';
import { resetE2eCatalogOrder } from './seed-e2e-procurement';

/**
 * /procurement (SUPERUSER only), designed phone-first. Data comes from
 * seed-e2e-procurement.ts; sign-in goes through the real /api/user/signin.
 *
 * Tests here only read seeded orders, except the catalog test, which adds a
 * product to its own throwaway order, so they are safe to run in parallel.
 */

const { mainOrder, secondOrder, catalogOrder, products, suppliers } =
  E2E_PROCUREMENT;

const MOBILE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
};

const tab = (page: Page, name: RegExp) => page.getByRole('tab', { name });
const productsTab = (page: Page) => tab(page, /Товары/);
const suppliersTab = (page: Page) => tab(page, /Поставщики/);
const pricesTab = (page: Page) => tab(page, /Цены/);

/** Header chip (mobile) / switcher (desktop) that opens the orders sheet. */
function orderSwitcher(page: Page): Locator {
  return page.getByRole('button', { name: /Сменить заказ/ });
}

const openProcurement = async (page: Page, orderId: string = mainOrder.id) => {
  await page.goto(`/procurement?order=${orderId}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(productsTab(page)).toBeVisible();
  // The header shows the order's name once it has loaded.
  await expect(orderSwitcher(page)).toBeVisible();
};

/** Price inputs are labelled "<supplier>, <product>". */
const priceInput = (page: Page, supplier: string, product: string) =>
  page.getByRole('textbox', { name: `${supplier}, ${product}`, exact: true });

const expectNoHorizontalOverflow = async (page: Page, where: string) => {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `horizontal overflow: ${where}`).toBeLessThanOrEqual(
    innerWidth,
  );
};

const expectOnlyInsideViewport = async (
  page: Page,
  locator: Locator,
  where: string,
) => {
  const box = await locator.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box, `${where}: not rendered`).not.toBeNull();
  expect(box!.x, `${where}: starts off-screen`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${where}: ends off-screen`).toBeLessThanOrEqual(
    width + 0.5,
  );
};

type SharedWindow = Window & { sharedFiles?: string[] };

/**
 * Pins the Web Share API so the workflow takes a known path: without it the
 * files download straight away, with it they wait in a share sheet (phones).
 * The stub records the shared file names instead of opening a system sheet.
 */
const stubWebShare = (page: Page, available: boolean) =>
  page.addInitScript((on) => {
    const define = (key: string, value: unknown) =>
      Object.defineProperty(Navigator.prototype, key, {
        value,
        configurable: true,
        writable: true,
      });
    if (!on) {
      define('share', undefined);
      define('canShare', undefined);
      return;
    }
    define('canShare', () => true);
    define('share', async ({ files }: { files: File[] }) => {
      (window as SharedWindow).sharedFiles = files.map((f) => f.name);
    });
  }, available);

/** The "empty files" row of the workflow card, unfolding it on phones. */
const emptyFilesStep = async (page: Page): Promise<Locator> => {
  const workflow = page.getByTestId('procurement-workflow');
  const unfold = workflow.getByRole('button', { name: 'Показать все шаги' });
  if (await unfold.isVisible()) await unfold.click();
  const step = workflow
    .getByRole('listitem')
    .filter({ hasText: 'Пустые файлы для поставщиков' });
  await expect(step).toBeVisible();
  return step;
};

const xlsxRows = async (download: Download): Promise<unknown[][]> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await download.path());
  const rows: unknown[][] = [];
  workbook.getWorksheet('Order')?.eachRow((row) => {
    rows.push((row.values as unknown[]).slice(1));
  });
  return rows;
};

test.describe('Procurement access', () => {
  test('a FREE user is sent away from /procurement', async ({
    page,
    context,
  }) => {
    await signInAs(context, 'free');
    await page.goto('/procurement', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/procurement/);
    await expect(productsTab(page)).toHaveCount(0);
  });

  test('a signed-out visitor never sees the procurement screen', async ({
    page,
  }) => {
    await page.goto('/procurement', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(productsTab(page)).toHaveCount(0);
    await expect(page.getByText(mainOrder.name)).toHaveCount(0);
  });

  test('a SUPERUSER opens the latest order by default', async ({
    page,
    context,
  }) => {
    await signInAs(context, 'superuser');
    await page.goto('/procurement', { waitUntil: 'domcontentloaded' });
    await expect(orderSwitcher(page)).toContainText(mainOrder.name);
  });
});

test.describe('Procurement on a phone (390x844)', () => {
  test.use(MOBILE);

  test.beforeEach(async ({ context }) => {
    await signInAs(context, 'superuser');
  });

  test('pill tabs switch panels', async ({ page }) => {
    await openProcurement(page);
    await expect(page.getByRole('tab')).toHaveCount(3);
    await expect(productsTab(page)).toHaveAttribute('aria-selected', 'true');
    await expect(productsTab(page)).toContainText('3');
    await expect(suppliersTab(page)).toContainText('2');

    await suppliersTab(page).click();
    await expect(suppliersTab(page)).toHaveAttribute('aria-selected', 'true');
    await expect(productsTab(page)).toHaveAttribute('aria-selected', 'false');

    await pricesTab(page).click();
    await expect(pricesTab(page)).toHaveAttribute('aria-selected', 'true');
    await expect(suppliersTab(page)).toHaveAttribute('aria-selected', 'false');

    await productsTab(page).click();
    await expect(productsTab(page)).toHaveAttribute('aria-selected', 'true');
  });

  test('header, rate card and workflow fit the screen', async ({ page }) => {
    await openProcurement(page);
    await expect(orderSwitcher(page)).toContainText(mainOrder.name);
    await expectOnlyInsideViewport(page, orderSwitcher(page), 'order chip');
    await expectNoHorizontalOverflow(page, 'page top');
  });

  test('products panel lists the order products and fits', async ({ page }) => {
    await openProcurement(page);
    for (const name of [products.longName, products.galaxy, products.airpods]) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    await expect(page.getByText(products.pixel)).toHaveCount(0);
    // The long name wraps instead of widening its row.
    await expectOnlyInsideViewport(
      page,
      page.getByText(products.longName, { exact: true }),
      'long product name',
    );
    await expectNoHorizontalOverflow(page, 'products tab');
  });

  test('suppliers panel lists the order suppliers and fits', async ({
    page,
  }) => {
    await openProcurement(page);
    await suppliersTab(page).click();
    for (const name of [suppliers.storeA, suppliers.storeB]) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    await expect(page.getByText(suppliers.storeC)).toHaveCount(0);
    await expectNoHorizontalOverflow(page, 'suppliers tab');
  });

  test('prices panel shows products, suppliers and decimal prices', async ({
    page,
  }) => {
    await openProcurement(page);
    await pricesTab(page).click();
    await expect(page.getByTestId('prices-panel')).toBeVisible();
    await expect(page.getByText(products.longName).first()).toBeVisible();
    await expect(page.getByText(suppliers.storeB).first()).toBeVisible();
    // 1039.75 is stored as a Float; the old UI dropped the decimals.
    await expect(
      priceInput(page, suppliers.storeB, products.longName),
    ).toHaveValue(/^1[\s\u00a0]?039[.,]75$/);
    // The whole price must be visible, not cut off inside the field.
    const clipped = await priceInput(
      page,
      suppliers.storeB,
      products.longName,
    ).evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(clipped, 'price text clipped inside its field').toBeLessThanOrEqual(
      0,
    );
    await expectNoHorizontalOverflow(page, 'prices tab');
  });

  test('catalog sheet: search finds a product and adds it to the order', async ({
    page,
  }) => {
    await resetE2eCatalogOrder();
    await openProcurement(page, catalogOrder.id);
    await page.getByRole('button', { name: 'Добавить товары' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expectNoHorizontalOverflow(page, 'catalog sheet (empty)');

    await sheet.getByRole('textbox', { name: 'Поиск товаров' }).fill('Anker');
    await expect(sheet.getByText(products.catalogOnly)).toBeVisible();
    await expect(sheet.getByText(products.galaxy)).toHaveCount(0);
    await expectNoHorizontalOverflow(page, 'catalog sheet (results)');

    await sheet
      .getByRole('button', {
        name: `Добавить в заказ: ${products.catalogOnly}`,
      })
      .click();
    await expect(sheet.getByText('В заказе')).toBeVisible();
    await sheet.getByRole('button', { name: /Готово/ }).click();
    await expect(sheet).toBeHidden();
    await expect(
      page.getByText(products.catalogOnly, { exact: true }),
    ).toBeVisible();
    await expect(productsTab(page)).toContainText('1');

    // It was saved, not just shown: it is still there after a reload.
    await openProcurement(page, catalogOrder.id);
    await expect(
      page.getByText(products.catalogOnly, { exact: true }),
    ).toBeVisible();
  });

  test('catalog sheet for suppliers searches suppliers', async ({ page }) => {
    await openProcurement(page);
    await suppliersTab(page).click();
    await page.getByRole('button', { name: /Добавить поставщиков/ }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await sheet
      .getByRole('textbox', { name: 'Поиск поставщиков' })
      .fill('Istanbul');
    await expect(sheet.getByText(suppliers.storeC)).toBeVisible();
    await expectNoHorizontalOverflow(page, 'supplier catalog sheet');
    await sheet.getByRole('button', { name: 'Закрыть' }).click();
    await expect(sheet).toBeHidden();
  });

  test('rate card shows the decimal rate and the currency sheet fits', async ({
    page,
  }) => {
    // The second order is in TMT, whose seeded rate is 19.5.
    await openProcurement(page, secondOrder.id);
    const card = page.getByTestId('procurement-rate-card');
    const rate = card.getByRole('textbox', { name: 'Курс' });
    await expect(rate).toHaveValue(/^19[.,]5$/);
    await expect(rate).toHaveAttribute('inputmode', 'decimal');

    await card.getByRole('button', { name: /Валюта заказа: TMT/ }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('radio', { name: /TMT/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expectNoHorizontalOverflow(page, 'currency sheet');
    await sheet.getByRole('button', { name: 'Закрыть' }).click();
    await expect(sheet).toBeHidden();
  });

  test('orders sheet opens from the header and switches orders', async ({
    page,
  }) => {
    await openProcurement(page);
    await orderSwitcher(page).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(mainOrder.name)).toBeVisible();
    await expect(sheet.getByText(secondOrder.name)).toBeVisible();
    await expectNoHorizontalOverflow(page, 'orders sheet');

    await sheet.getByText(secondOrder.name).click();
    await expect(sheet).toBeHidden();
    await expect(orderSwitcher(page)).toContainText(secondOrder.name);
    await expect(page.getByText(products.pixel, { exact: true })).toBeVisible();
    await expect(page.getByText(products.galaxy)).toHaveCount(0);
    await expect(productsTab(page)).toContainText('1');
  });

  test('new order dialog opens from the header and fits', async ({ page }) => {
    await openProcurement(page);
    await page.getByRole('button', { name: 'Новый заказ' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('textbox')).toBeVisible();
    await expectNoHorizontalOverflow(page, 'new order dialog');
    // Cancel: creating an order would change which order is "latest".
    await sheet
      .getByRole('button', { name: /Отмена|Закрыть/ })
      .first()
      .click();
    await expect(sheet).toBeHidden();
  });

  test('workflow: "empty files" step downloads one xlsx per supplier', async ({
    page,
  }) => {
    await stubWebShare(page, false);
    await openProcurement(page);
    const step = await emptyFilesStep(page);
    await expectNoHorizontalOverflow(page, 'workflow expanded');

    const downloads: Download[] = [];
    page.on('download', (d) => downloads.push(d));
    await step.getByRole('button', { name: 'Скачать' }).click();
    await expect.poll(() => downloads.length).toBe(2);

    const names = downloads.map((d) => d.suggestedFilename()).sort();
    expect(names[0]).toMatch(/Ashgabat.*\.xlsx$/);
    expect(names[1]).toMatch(/Dubai.*\.xlsx$/);

    // The file a store receives lists every product with its quantity.
    const rows = await xlsxRows(downloads[0]);
    expect(rows).toContainEqual(expect.arrayContaining([products.galaxy, 5]));
    expect(rows).toContainEqual(expect.arrayContaining([products.longName, 2]));
    expect(rows).toContainEqual(expect.arrayContaining([products.airpods, 10]));
  });

  test('workflow: with Web Share the files sheet shares or downloads', async ({
    page,
  }) => {
    await stubWebShare(page, true);
    await openProcurement(page);
    const step = await emptyFilesStep(page);
    await step.getByRole('button', { name: 'Отправить' }).click();

    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByText(suppliers.storeA, { exact: true }),
    ).toBeVisible();
    await expect(
      sheet.getByText(suppliers.storeB, { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, 'files sheet');

    await sheet
      .getByRole('button', { name: `Отправить: ${suppliers.storeB}` })
      .click();
    await expect
      .poll(() => page.evaluate(() => (window as SharedWindow).sharedFiles))
      .toEqual([expect.stringMatching(/Dubai.*\.xlsx$/)]);

    const downloads: Download[] = [];
    page.on('download', (d) => downloads.push(d));
    await sheet.getByRole('button', { name: 'Скачать все' }).click();
    await expect.poll(() => downloads.length).toBe(2);
  });
});

test.describe('Procurement on desktop (1440x900)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('panels render and nothing overflows', async ({ page, context }) => {
    await signInAs(context, 'superuser');
    await openProcurement(page);
    await expect(
      page.getByText(products.longName, { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, 'desktop products');

    await suppliersTab(page).click();
    await expect(
      page.getByText(suppliers.storeA, { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, 'desktop suppliers');

    await pricesTab(page).click();
    await expect(
      priceInput(page, suppliers.storeA, products.galaxy),
    ).toHaveValue(/^899[.,]25$/);
    await expectNoHorizontalOverflow(page, 'desktop prices');

    await orderSwitcher(page).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText(secondOrder.name)).toBeVisible();
    await expectNoHorizontalOverflow(page, 'desktop orders dialog');
  });
});
