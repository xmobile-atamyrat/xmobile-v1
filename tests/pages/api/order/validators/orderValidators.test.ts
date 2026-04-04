import { UserOrderStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  cancelOrderSchema,
  createOrderSchema,
  getAdminOrdersQuerySchema,
  getOrdersQuerySchema,
  updateAdminNotesSchema,
  updateOrderStatusSchema,
} from '@/pages/api/order/validators/orderValidators';

describe('createOrderSchema', () => {
  it('accepts a valid payload', () => {
    const r = createOrderSchema.safeParse({
      deliveryAddress: 'Addr',
      deliveryPhone: '+123',
      notes: 'Leave at door',
      updateAddress: true,
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty address or phone', () => {
    expect(
      createOrderSchema.safeParse({
        deliveryAddress: '',
        deliveryPhone: '+1',
      }).success,
    ).toBe(false);
    expect(
      createOrderSchema.safeParse({
        deliveryAddress: 'A',
        deliveryPhone: '',
      }).success,
    ).toBe(false);
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
