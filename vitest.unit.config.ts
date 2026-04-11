import path from 'node:path';

import { defineProject } from 'vitest/config';

const rootDir = path.resolve(__dirname);

export default defineProject({
  root: rootDir,
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  test: {
    name: 'unit',
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    env: {
      TZ: 'UTC',
    },
    testTimeout: 10000,
  },
});
