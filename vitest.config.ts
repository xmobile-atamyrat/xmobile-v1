import { defineConfig } from 'vitest/config';

/**
 * Unit + client UI tests. Integration tests use `vitest.integration.config.ts`.
 * @see vitest.unit.config.ts
 * @see vitest.client.config.ts
 */
export default defineConfig({
  test: {
    projects: ['./vitest.unit.config.ts', './vitest.client.config.ts'],
  },
});
