import path from 'node:path';

import react from '@vitejs/plugin-react-swc';
import { defineProject } from 'vitest/config';

const rootDir = path.resolve(__dirname);

export default defineProject({
  root: rootDir,
  plugins: [react({ jsxRuntime: 'automatic' })],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
      'next/font/google': path.resolve(
        rootDir,
        './tests/client/mocks/next-font-google.ts',
      ),
    },
  },
  test: {
    name: 'client',
    environment: 'node',
    include: ['tests/client/**/*.test.ts'],
    setupFiles: ['./tests/client/setup.ts'],
  },
});
