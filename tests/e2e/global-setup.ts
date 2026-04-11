import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

import { E2E_ORIGIN, E2E_PORT } from './constants';
import { startIntegrationDatabase } from '../integration/setup-database';
import { seedE2eCatalog } from './seed-e2e-catalog';

const ACCESS_TOKEN_SECRET = 'e2e-access-token-secret-32chars-min';
const REFRESH_TOKEN_SECRET = 'e2e-refresh-token-secret-32chars-min';

const rootDir = process.cwd();

let nextProcess: ChildProcess | undefined;

function buildNextEnv(databaseUrl: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: databaseUrl,
    ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET,
    NODE_ENV: 'development',
    NEXT_PUBLIC_HOST: '127.0.0.1',
    NEXT_PUBLIC_PORT: E2E_PORT,
    E2E_ORIGIN,
  };
}

async function waitForHttpOk(
  url: string,
  timeoutMs: number,
  pathSuffix: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}${pathSuffix}`);
      if (res.ok) {
        return;
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 500);
    });
  }
  throw new Error(
    `Timed out waiting for ${url}${pathSuffix}: ${String(lastErr)}`,
  );
}

/**
 * 1) Postgres (Testcontainers) + Prisma migrate + E2E seed
 * 2) Start `next dev` with that `DATABASE_URL` (Playwright `webServer` runs too early,
 *    so we own the server lifecycle here.)
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const { databaseUrl, stop } = await startIntegrationDatabase();

  process.env.DATABASE_URL = databaseUrl;
  process.env.ACCESS_TOKEN_SECRET = ACCESS_TOKEN_SECRET;
  process.env.REFRESH_TOKEN_SECRET = REFRESH_TOKEN_SECRET;
  process.env.NEXT_PUBLIC_HOST = '127.0.0.1';
  process.env.NEXT_PUBLIC_PORT = E2E_PORT;
  process.env.E2E_ORIGIN = E2E_ORIGIN;

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  await prisma.$connect();
  await seedE2eCatalog(prisma);
  await prisma.$disconnect();

  const nextCli = path.join(rootDir, 'node_modules/next/dist/bin/next');
  nextProcess = spawn(
    process.execPath,
    [nextCli, 'dev', '-p', E2E_PORT, '-H', '0.0.0.0'],
    {
      cwd: rootDir,
      env: buildNextEnv(databaseUrl),
      stdio: 'inherit',
    },
  );

  await waitForHttpOk(E2E_ORIGIN, 180_000, '/api/category');

  return async () => {
    if (nextProcess?.pid != null) {
      nextProcess.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 2000);
      });
    }
    await stop();
  };
}
