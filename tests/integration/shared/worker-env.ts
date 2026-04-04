import { inject } from 'vitest';
import { vi } from 'vitest';

import type { IntegrationCatalog } from './integration-types';
import { resetPrismaGlobalSingleton } from '../helpers/reset-prisma-global';

const ACCESS_TOKEN_SECRET = 'int-test-access-secret-32chars-xx';
const REFRESH_TOKEN_SECRET = 'int-test-refresh-secret-32chary';

/**
 * Point `process.env` + app Prisma singleton at the shared integration DB (from globalSetup).
 * Call once per test file `beforeAll`, before any dynamic `import()` of API routes.
 */
export async function prepareIntegrationWorker(): Promise<{
  databaseUrl: string;
  catalog: IntegrationCatalog;
}> {
  const databaseUrl = inject('integrationDatabaseUrl');
  const catalog = inject('integrationCatalog');

  process.env.DATABASE_URL = databaseUrl;
  vi.stubEnv('ACCESS_TOKEN_SECRET', ACCESS_TOKEN_SECRET);
  vi.stubEnv('REFRESH_TOKEN_SECRET', REFRESH_TOKEN_SECRET);
  vi.stubEnv('NODE_ENV', 'test');

  await resetPrismaGlobalSingleton();
  vi.resetModules();

  return { databaseUrl, catalog };
}

export function teardownIntegrationWorker(): void {
  vi.unstubAllEnvs();
}
