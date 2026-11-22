import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, UserRole } from '@prisma/client';
import { createMocks } from 'node-mocks-http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal } from './shared/staff-token';
import { signupTestUser } from './shared/signup-test-user';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

// The web "Ongoing" / "Completed" tabs send these exact lists
// (TAB_STATUSES in src/pages/orders/index.page.tsx).
const ONGOING = 'PENDING,IN_PROGRESS,ON_THE_WAY';
const COMPLETED = 'COMPLETED,USER_CANCELLED,ADMIN_CANCELLED';

describe('ON_THE_WAY order status (integration)', () => {
  let prisma: PrismaClient;
  let productId: string;

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    productId = catalog.productId;
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

  const createOrder = (userId: string, email: string) =>
    prisma.userOrder.create({
      data: {
        orderNumber: `ORD-OTW-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId,
        userName: 'Buyer',
        userEmail: email,
        totalPrice: '50',
        deliveryAddress: 'Addr',
        deliveryPhone: '+99361000001',
        status: 'PENDING',
        items: {
          create: [
            {
              quantity: 1,
              productName: '{"en":"P"}',
              productPrice: '50',
              productId,
            },
          ],
        },
      },
    });

  const setStatus = async (
    accessToken: string,
    orderId: string,
    status: string,
  ) => {
    const handler = (await import('@/pages/api/order/admin/[id].page')).default;
    const { req, res } = createMocks({
      method: 'PUT',
      url: '/api/order/admin/x',
      headers: { authorization: `Bearer ${accessToken}` },
      query: { id: orderId, action: 'status' },
      body: { status },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    return res;
  };

  const listOwnOrders = async (accessToken: string, status: string) => {
    const handler = (await import('@/pages/api/order/index.page')).default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/order',
      headers: { authorization: `Bearer ${accessToken}` },
      query: { status },
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(200);
    return (
      JSON.parse(res._getData() as string).data.orders as { id: string }[]
    ).map((o) => o.id);
  };

  it('admin moves an order to ON_THE_WAY and the owner is notified in Russian', async () => {
    const buyer = await signupTestUser('otw-buyer');
    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    const order = await createOrder(buyer.userId, buyer.email);

    expect(
      (
        await setStatus(admin.accessToken, order.id, 'IN_PROGRESS')
      )._getStatusCode(),
    ).toBe(200);
    const res = await setStatus(admin.accessToken, order.id, 'ON_THE_WAY');
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData() as string).data.status).toBe('ON_THE_WAY');

    const stored = await prisma.userOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(stored.status).toBe('ON_THE_WAY');
    // Only COMPLETED and ADMIN_CANCELLED stamp a closing time.
    expect(stored.completedAt).toBeNull();
    expect(stored.cancelledAt).toBeNull();

    // The owner notification is fire-and-forget, so wait for its row.
    await vi.waitFor(async () => {
      const notifications = await prisma.inAppNotification.findMany({
        where: { userId: buyer.userId, orderId: order.id },
      });
      expect(
        notifications.some(
          (n) =>
            n.content ===
            `Статус вашего заказа #${order.orderNumber} изменен с "В процессе" на "В пути"`,
        ),
      ).toBe(true);
    });
  });

  it('an ON_THE_WAY order is under the Ongoing tab, not Completed', async () => {
    const buyer = await signupTestUser('otw-tabs');
    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    const order = await createOrder(buyer.userId, buyer.email);
    await setStatus(admin.accessToken, order.id, 'ON_THE_WAY');

    expect(await listOwnOrders(buyer.accessToken, ONGOING)).toContain(order.id);
    expect(await listOwnOrders(buyer.accessToken, 'ON_THE_WAY')).toEqual([
      order.id,
    ]);
    expect(await listOwnOrders(buyer.accessToken, COMPLETED)).not.toContain(
      order.id,
    );
  });

  it('an ON_THE_WAY order can still be completed', async () => {
    const buyer = await signupTestUser('otw-complete');
    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    const order = await createOrder(buyer.userId, buyer.email);
    await setStatus(admin.accessToken, order.id, 'ON_THE_WAY');

    expect(
      (
        await setStatus(admin.accessToken, order.id, 'COMPLETED')
      )._getStatusCode(),
    ).toBe(200);
    const stored = await prisma.userOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(stored.status).toBe('COMPLETED');
    expect(stored.completedAt).not.toBeNull();
  });
});
