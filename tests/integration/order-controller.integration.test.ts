import { PrismaClient, UserRole } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

describe('Order controller validation (integration)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const { databaseUrl } = await prepareIntegrationWorker();
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
  });

  it('createOrderController rejects empty cart', async () => {
    const { createOrderController } = await import(
      '@/pages/api/order/controllers/orderController'
    );
    const orphan = await prisma.user.create({
      data: {
        email: `orphan-${Date.now()}@test.local`,
        name: 'Orphan',
        password: 'hash',
        grade: UserRole.FREE,
      },
    });

    const { resp, status } = await createOrderController(
      {
        deliveryAddress: 'A',
        deliveryPhone: 'B',
      },
      orphan.id,
    );

    expect(status).toBe(400);
    expect(resp.success).toBe(false);
    expect(String(resp.message)).toContain('Cart is empty');

    await prisma.user.delete({ where: { id: orphan.id } });
  });

  it('createOrderController rejects invalid body', async () => {
    const { createOrderController } = await import(
      '@/pages/api/order/controllers/orderController'
    );
    const { resp, status } = await createOrderController(
      { deliveryAddress: '', deliveryPhone: '' },
      'any-user-id',
    );
    expect(status).toBe(400);
    expect(resp.success).toBe(false);
    expect(String(resp.message)).toMatch(/Validation error|required/i);
  });
});
