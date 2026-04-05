import path from 'node:path';
import { defineConfig } from 'vitest/config';

const rootDir = path.resolve(__dirname);

export default defineConfig({
  root: rootDir,
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    passWithNoTests: false,
    env: {
      TZ: 'UTC',
    },
  },
});
