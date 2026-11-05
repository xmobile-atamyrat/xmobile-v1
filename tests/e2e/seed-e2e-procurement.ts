import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import {
  E2E_PASSWORD,
  E2E_PROCUREMENT,
  E2E_USERS,
} from './fixtures/procurement';

/**
 * Users (one SUPERUSER, one FREE) that specs sign in as through the real
 * `/api/user/signin`, plus dollar rates and procurement orders for the
 * `/procurement` screen.
 */
export async function seedE2eProcurement(prisma: PrismaClient): Promise<void> {
  const password = await bcrypt.hash(E2E_PASSWORD, 10);
  await prisma.user.createMany({
    data: Object.values(E2E_USERS).map(({ id, email, name, grade }) => ({
      id,
      email,
      name,
      grade,
      password,
    })),
  });

  await prisma.dollarRate.createMany({
    data: [
      { currency: 'TMT', rate: 19.5, name: 'Manat', isDefault: true },
      { currency: 'USD', rate: 1, name: 'Dollar' },
    ],
  });

  const { products: p, suppliers: s } = E2E_PROCUREMENT;
  const product = Object.fromEntries(
    await Promise.all(
      Object.entries(p).map(async ([key, name]) => [
        key,
        (await prisma.procurementProduct.create({ data: { name } })).id,
      ]),
    ),
  ) as Record<keyof typeof p, string>;
  const supplier = Object.fromEntries(
    await Promise.all(
      Object.entries(s).map(async ([key, name]) => [
        key,
        (await prisma.procurementSupplier.create({ data: { name } })).id,
      ]),
    ),
  ) as Record<keyof typeof s, string>;

  const now = Date.now();
  const seedOrder = async (
    { id, name }: { id: string; name: string },
    {
      ageMinutes,
      currency,
      lines,
      supplierIds,
      prices,
    }: {
      ageMinutes: number;
      currency: 'USD' | 'TMT';
      lines: [productId: string, quantity: number][];
      supplierIds: string[];
      prices: [productId: string, supplierId: string, price: number][];
    },
  ) => {
    await prisma.procurementOrder.create({
      data: {
        id,
        name,
        currency,
        createdAt: new Date(now - ageMinutes * 60_000),
      },
    });
    for (const [productId, quantity] of lines) {
      await prisma.procurementOrderProduct.create({
        data: { orderId: id, productId },
      });
      await prisma.procurementOrderProductQuantity.create({
        data: { orderId: id, productId, quantity },
      });
    }
    for (const supplierId of supplierIds) {
      await prisma.procurementOrderSupplier.create({
        data: { orderId: id, supplierId },
      });
    }
    for (const [productId, supplierId, price] of prices) {
      await prisma.procurementSupplierProductPrice.create({
        data: { orderId: id, productId, supplierId, price, color: 'white' },
      });
    }
  };

  await seedOrder(E2E_PROCUREMENT.mainOrder, {
    ageMinutes: 1,
    currency: 'USD',
    lines: [
      [product.longName, 2],
      [product.galaxy, 5],
      [product.airpods, 10],
    ],
    supplierIds: [supplier.storeA, supplier.storeB],
    prices: [
      [product.longName, supplier.storeA, 1049.5],
      [product.longName, supplier.storeB, 1039.75],
      [product.galaxy, supplier.storeA, 899.25],
      [product.galaxy, supplier.storeB, 910],
      [product.airpods, supplier.storeA, 189.9],
      [product.airpods, supplier.storeB, 185.5],
    ],
  });

  await seedOrder(E2E_PROCUREMENT.secondOrder, {
    ageMinutes: 60,
    currency: 'TMT',
    lines: [[product.pixel, 3]],
    supplierIds: [supplier.storeC],
    prices: [[product.pixel, supplier.storeC, 16_500]],
  });

  await seedOrder(E2E_PROCUREMENT.catalogOrder, {
    ageMinutes: 120,
    currency: 'USD',
    lines: [],
    supplierIds: [supplier.storeA],
    prices: [],
  });
}

/**
 * Empties the catalog test's order again so that test can be retried (or run
 * with --repeat-each) against the same database.
 */
export async function resetE2eCatalogOrder(): Promise<void> {
  // DATABASE_URL is the e2e container's: global setup exports it to workers.
  const prisma = new PrismaClient();
  try {
    const orderId = E2E_PROCUREMENT.catalogOrder.id;
    await prisma.procurementOrderProductQuantity.deleteMany({
      where: { orderId },
    });
    await prisma.procurementOrderProduct.deleteMany({ where: { orderId } });
  } finally {
    await prisma.$disconnect();
  }
}
