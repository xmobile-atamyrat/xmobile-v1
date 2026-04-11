import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import { E2E_ORIGIN } from './tests/e2e/constants';

const rootDir = process.cwd();

/**
 * E2E tests live under `tests/e2e/`.
 *
 * The Next.js server is started in {@link tests/e2e/global-setup.ts} **after**
 * Postgres (Testcontainers) is up and seeded, so API routes and SSR see the
 * same database. Do not use Playwright `webServer` for this app: it starts
 * before `globalSetup` and would boot Next against `.env.local` first.
 */
export default defineConfig({
  testDir: path.join(rootDir, 'tests', 'e2e'),
  globalSetup: path.join(rootDir, 'tests', 'e2e', 'global-setup.ts'),
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? E2E_ORIGIN,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    locale: 'ru',
    timezoneId: 'Asia/Ashgabat',
  },
});
