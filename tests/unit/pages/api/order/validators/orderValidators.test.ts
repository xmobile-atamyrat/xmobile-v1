import { UserOrderStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  cancelOrderSchema,
  createGuestOrderSchema,
  createOrderSchema,
  getAdminOrdersQuerySchema,
  getOrdersQuerySchema,
  updateAdminNotesSchema,
  updateDeliveryPriceSchema,
  updateOrderStatusSchema,
} from '@/pages/api/order/validators/orderValidators';
import { PICKUP_ADDRESS } from '@/pages/lib/orderDelivery';

describe('createOrderSchema', () => {
  it('accepts a valid payload', () => {
    const r = createOrderSchema.safeParse({
      deliveryAddress: 'Addr',
      deliveryPhone: '+99361234567',
      notes: 'Leave at door',
      updateAddress: true,
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty address or phone', () => {
    expect(
      createOrderSchema.safeParse({
        deliveryAddress: '',
        deliveryPhone: '+99361234567',
      }).success,
    ).toBe(false);
    expect(
      createOrderSchema.safeParse({
        deliveryAddress: 'A',
        deliveryPhone: '',
      }).success,
    ).toBe(false);
  });

  it('rejects an unsupported or malformed phone', () => {
    ['Test', '+123', '+7 916 123 45 67', '8 61 23456'].forEach((phone) => {
      expect(
        createOrderSchema.safeParse({
          deliveryAddress: 'A',
          deliveryPhone: phone,
        }).success,
      ).toBe(false);
    });
  });

  it('normalizes the phone to +993 form', () => {
    const r = createOrderSchema.parse({
      deliveryAddress: 'A',
      deliveryPhone: '8 (61) 23-45-67',
    });
    expect(r.deliveryPhone).toBe('+99361234567');
  });

  it('accepts a Turkish phone', () => {
    const r = createOrderSchema.parse({
      deliveryAddress: 'A',
      deliveryPhone: '+90 532 123 45 67',
    });
    expect(r.deliveryPhone).toBe('+905321234567');
  });
});

describe('updateOrderStatusSchema', () => {
  it('accepts a valid status enum', () => {
    const r = updateOrderStatusSchema.safeParse({
      status: UserOrderStatus.PENDING,
    });
    expect(r.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const r = updateOrderStatusSchema.safeParse({ status: 'INVALID' });
    expect(r.success).toBe(false);
  });
});

describe('updateAdminNotesSchema', () => {
  it('requires non-empty adminNotes', () => {
    expect(updateAdminNotesSchema.safeParse({ adminNotes: 'ok' }).success).toBe(
      true,
    );
    expect(updateAdminNotesSchema.safeParse({ adminNotes: '' }).success).toBe(
      false,
    );
  });
});

describe('getOrdersQuerySchema', () => {
  it('defaults page and limit when omitted', () => {
    const r = getOrdersQuerySchema.parse({});
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
  });

  it('parses page and limit from strings', () => {
    const r = getOrdersQuerySchema.parse({ page: '3', limit: '10' });
    expect(r.page).toBe(3);
    expect(r.limit).toBe(10);
  });

  it('accepts optional status and date range', () => {
    const r = getOrdersQuerySchema.parse({
      status: UserOrderStatus.COMPLETED,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    });
    expect(r.status).toBe(UserOrderStatus.COMPLETED);
    expect(r.dateFrom).toBe('2024-01-01');
  });
});

describe('getAdminOrdersQuerySchema', () => {
  it('includes searchKeyword and same pagination rules', () => {
    const r = getAdminOrdersQuerySchema.parse({
      searchKeyword: 'iphone',
      page: '2',
    });
    expect(r.searchKeyword).toBe('iphone');
    expect(r.page).toBe(2);
    expect(r.limit).toBe(20);
  });
});

describe('cancelOrderSchema', () => {
  it('allows empty body with optional reason', () => {
    expect(cancelOrderSchema.safeParse({}).success).toBe(true);
    expect(
      cancelOrderSchema.safeParse({ cancellationReason: 'changed mind' })
        .success,
    ).toBe(true);
  });
});

const phone = '+99361000000';

describe('order delivery validation', () => {
  it('defaults to delivery and requires an address for it', () => {
    expect(createOrderSchema.safeParse({ deliveryPhone: phone }).success).toBe(
      false,
    );
    const parsed = createOrderSchema.parse({
      deliveryPhone: phone,
      deliveryAddress: '  Main st 1 ',
    });
    expect(parsed.deliveryMethod).toBe('DELIVERY');
    expect(parsed.deliveryAddress).toBe('Main st 1');
  });

  it('stores the pickup marker instead of an address for pickup', () => {
    const parsed = createGuestOrderSchema.parse({
      deliveryMethod: 'PICKUP',
      deliveryPhone: phone,
      deliveryAddress: 'ignored',
      userName: 'Guest',
    });
    expect(parsed.deliveryAddress).toBe(PICKUP_ADDRESS);
    expect(parsed.userName).toBe('Guest');
  });

  it('rejects the pickup marker as a delivery address', () => {
    expect(
      createOrderSchema.safeParse({
        deliveryMethod: 'DELIVERY',
        deliveryPhone: phone,
        deliveryAddress: ' pickup ',
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown delivery method', () => {
    expect(
      createOrderSchema.safeParse({
        deliveryMethod: 'DRONE',
        deliveryPhone: phone,
        deliveryAddress: 'Main st 1',
      }).success,
    ).toBe(false);
  });

  it('accepts a non-negative delivery price only', () => {
    expect(updateDeliveryPriceSchema.parse({ deliveryPrice: '15.5' })).toEqual({
      deliveryPrice: 15.5,
    });
    expect(
      updateDeliveryPriceSchema.safeParse({ deliveryPrice: -1 }).success,
    ).toBe(false);
    expect(
      updateDeliveryPriceSchema.safeParse({ deliveryPrice: 'abc' }).success,
    ).toBe(false);
  });
});
