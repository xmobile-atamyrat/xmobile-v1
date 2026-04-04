import { PrismaClient, UserRole } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startIntegrationDatabase } from './setup-database';

/**
 * Dedicated Prisma client with an explicit datasource URL so we never rely on
 * `src/lib/dbClient.ts` (singleton + logger side effects).
 */
describe('Prisma + PostgreSQL', () => {
  let prisma: PrismaClient | undefined;
  let stopDb: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const { databaseUrl, stop } = await startIntegrationDatabase();
    stopDb = stop;
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await stopDb?.();
  });

  it('connects to a migrated schema', async () => {
    await expect(prisma.user.count()).resolves.toBeGreaterThanOrEqual(0);
  });

  it('can create and delete a user row', async () => {
    const email = `integration-${Date.now()}@test.local`;
    const user = await prisma.user.create({
      data: {
        name: 'Integration test user',
        email,
        password: 'hashed-placeholder',
        grade: UserRole.FREE,
      },
    });

    expect(user.id).toBeTruthy();
    expect(user.email).toBe(email);

    await prisma.user.delete({ where: { id: user.id } });
  });
});
