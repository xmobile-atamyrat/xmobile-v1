import { execSync } from 'node:child_process';

export type IntegrationDbHandle = {
  databaseUrl: string;
  stop: () => Promise<void>;
};

/**
 * Postgres via Testcontainers + `prisma migrate deploy`.
 * Requires Docker. Call from `beforeAll`; call `stop()` in `afterAll`.
 */
export async function startIntegrationDatabase(): Promise<IntegrationDbHandle> {
  const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('xmobile_integration')
    .withUsername('test')
    .withPassword('test')
    .start();

  const databaseUrl = container.getConnectionUri();

  execSync('yarn prisma migrate deploy', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  return {
    databaseUrl,
    stop: async () => {
      await container.stop();
    },
  };
}
