import path from 'node:path';
import { defineConfig } from 'vitest/config';

const rootDir = path.resolve(__dirname);

/**
 * Integration tests (Docker + Testcontainers Postgres).
 * Run: `yarn test:integration` or full `yarn test` (after unit tests).
 */
export default defineConfig({
  root: rootDir,
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.git/**'],
    hookTimeout: 120_000,
    testTimeout: 60_000,
    fileParallelism: false,
    passWithNoTests: false,
  },
});
