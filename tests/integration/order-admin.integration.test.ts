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

describe('Admin order API (integration)', () => {
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

  it('returns 401 for non-admin when listing admin orders', async () => {
    const free = await signupTestUser('adm-ord-free');
    const handler = (await import('@/pages/api/order/admin/index.page'))
      .default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/order/admin',
      headers: { authorization: `Bearer ${free.accessToken}` },
      query: {},
    });
    await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(401);
  });

  it('ADMIN lists orders, fetches by id, updates status and admin notes', async () => {
    const buyer = await signupTestUser('adm-ord-buyer');
    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    const orderNumber = `ORD-INTADM-${Date.now()}`;

    const order = await prisma.userOrder.create({
      data: {
        orderNumber,
        userId: buyer.userId,
        userName: 'Buyer',
        userEmail: buyer.email,
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

    const listHandler = (await import('@/pages/api/order/admin/index.page'))
      .default;
    const list = createMocks({
      method: 'GET',
      url: '/api/order/admin',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      query: {},
    });
    await listHandler(
      list.req as unknown as NextApiRequest,
      list.res as unknown as NextApiResponse,
    );
    expect(list.res._getStatusCode()).toBe(200);
    const orders = JSON.parse(list.res._getData() as string).data.orders as {
      id: string;
    }[];
    expect(orders.some((o) => o.id === order.id)).toBe(true);

    const detailHandler = (await import('@/pages/api/order/admin/[id].page'))
      .default;
    const get = createMocks({
      method: 'GET',
      url: '/api/order/admin/x',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      query: { id: order.id },
    });
    await detailHandler(
      get.req as unknown as NextApiRequest,
      get.res as unknown as NextApiResponse,
    );
    expect(get.res._getStatusCode()).toBe(200);

    const putStatus = createMocks({
      method: 'PUT',
      url: '/api/order/admin/x',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      query: { id: order.id, action: 'status' },
      body: { status: 'IN_PROGRESS' },
    });
    await detailHandler(
      putStatus.req as unknown as NextApiRequest,
      putStatus.res as unknown as NextApiResponse,
    );
    expect(putStatus.res._getStatusCode()).toBe(200);

    const putNotes = createMocks({
      method: 'PUT',
      url: '/api/order/admin/x',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      query: { id: order.id, action: 'notes' },
      body: { adminNotes: 'Packed' },
    });
    await detailHandler(
      putNotes.req as unknown as NextApiRequest,
      putNotes.res as unknown as NextApiResponse,
    );
    expect(putNotes.res._getStatusCode()).toBe(200);

    const badAction = createMocks({
      method: 'PUT',
      url: '/api/order/admin/x',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      query: { id: order.id, action: 'nope' },
      body: {},
    });
    await detailHandler(
      badAction.req as unknown as NextApiRequest,
      badAction.res as unknown as NextApiResponse,
    );
    expect(badAction.res._getStatusCode()).toBe(400);

    await prisma.userOrder.delete({ where: { id: order.id } });
    await prisma.user.delete({ where: { id: admin.userId } });
  });

  it('ADMIN sets the delivery price on top of the charged total', async () => {
    const buyer = await signupTestUser('adm-ord-delivery');
    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    const detailHandler = (await import('@/pages/api/order/admin/[id].page'))
      .default;

    const makeOrder = (
      deliveryMethod: 'PICKUP' | 'DELIVERY',
      totalPrice = '50.00',
    ) =>
      prisma.userOrder.create({
        data: {
          orderNumber: `ORD-INTDLV-${Date.now()}-${Math.random()}`,
          userId: buyer.userId,
          totalPrice,
          deliveryAddress: deliveryMethod === 'PICKUP' ? 'PICKUP' : 'Main st 1',
          deliveryPhone: '+99361000002',
          status: 'PENDING',
          items: {
            create: [
              {
                quantity: 2,
                productName: '{"en":"P"}',
                productPrice: '25',
                productId,
              },
            ],
          },
        },
      });

    const setPrice = async (orderId: string, deliveryPrice: unknown) => {
      const { req, res } = createMocks({
        method: 'PUT',
        url: '/api/order/admin/x',
        headers: { authorization: `Bearer ${admin.accessToken}` },
        query: { id: orderId, action: 'delivery-price' },
        body: { deliveryPrice },
      });
      await detailHandler(
        req as unknown as NextApiRequest,
        res as unknown as NextApiResponse,
      );
      return res;
    };
    const dataOf = (res: Awaited<ReturnType<typeof setPrice>>) =>
      JSON.parse(res._getData() as string).data;

    const delivery = await makeOrder('DELIVERY');

    const first = await setPrice(delivery.id, 15);
    expect(first._getStatusCode()).toBe(200);
    expect(dataOf(first)).toMatchObject({
      deliveryPrice: '15.00',
      totalPrice: '65.00',
    });
    // The fee line stays out of the product items
    expect(dataOf(first).items).toHaveLength(1);

    const replaced = await setPrice(delivery.id, '10.5');
    expect(replaced._getStatusCode()).toBe(200);
    expect(dataOf(replaced).totalPrice).toBe('60.50');

    // Unchanged price: no extra notice
    expect((await setPrice(delivery.id, 10.5))._getStatusCode()).toBe(200);

    // Free delivery is a real answer, distinct from "not set yet"
    const free = await setPrice(delivery.id, 0);
    expect(dataOf(free)).toMatchObject({
      deliveryPrice: '0.00',
      totalPrice: '50.00',
    });

    await vi.waitFor(async () => {
      const notices = await prisma.inAppNotification.findMany({
        where: { userId: buyer.userId, orderId: delivery.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(notices.map((n) => n.content)).toEqual([
        expect.stringContaining('15.00 TMT'),
        expect.stringContaining('10.50 TMT'),
        expect.stringContaining('0.00 TMT'),
      ]);
    });

    expect((await setPrice(delivery.id, -5))._getStatusCode()).toBe(400);

    // The fee goes on top of what was charged, not a recomputed subtotal
    const offSnapshot = await makeOrder('DELIVERY', '51.00');
    expect(dataOf(await setPrice(offSnapshot.id, 15)).totalPrice).toBe('66.00');

    const pickup = await makeOrder('PICKUP');
    expect((await setPrice(pickup.id, 15))._getStatusCode()).toBe(400);

    await prisma.userOrder.update({
      where: { id: offSnapshot.id },
      data: { status: 'COMPLETED' },
    });
    expect((await setPrice(offSnapshot.id, 20))._getStatusCode()).toBe(400);

    await prisma.userOrder.update({
      where: { id: delivery.id },
      data: { status: 'ADMIN_CANCELLED' },
    });
    expect((await setPrice(delivery.id, 20))._getStatusCode()).toBe(400);

    await prisma.userOrder.deleteMany({
      where: { id: { in: [delivery.id, offSnapshot.id, pickup.id] } },
    });
    await prisma.user.delete({ where: { id: admin.userId } });
  });

  it('returns 405 for POST on admin order index', async () => {
    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    const listHandler = (await import('@/pages/api/order/admin/index.page'))
      .default;
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/order/admin',
      headers: { authorization: `Bearer ${admin.accessToken}` },
    });
    await listHandler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(405);
    await prisma.user.delete({ where: { id: admin.userId } });
  });

  it('admin detail returns 404 for unknown order id', async () => {
    const admin = await createStaffPrincipal(prisma, UserRole.ADMIN);
    const detailHandler = (await import('@/pages/api/order/admin/[id].page'))
      .default;
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/order/admin/x',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      query: { id: '00000000-0000-4000-8000-000000000077' },
    });
    await detailHandler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
    expect(res._getStatusCode()).toBe(404);
    await prisma.user.delete({ where: { id: admin.userId } });
  });
});
