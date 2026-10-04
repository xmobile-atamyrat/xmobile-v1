import { describe, expect, it } from 'vitest';

import {
  buildDeliveryFeeMeta,
  buildNotesMeta,
  buildStatusMeta,
  OrderSnapshot,
} from '@/lib/orderActivity';

const before: OrderSnapshot = {
  orderNumber: 'ORD-100',
  status: 'PENDING',
  adminNotes: null,
  deliveryPrice: null,
};

describe('buildStatusMeta', () => {
  it('records a status change', () => {
    expect(
      buildStatusMeta(before, {
        ...before,
        status: 'IN_PROGRESS',
        cancellationReason: null,
      }),
    ).toEqual({
      orderNumber: 'ORD-100',
      kind: 'STATUS',
      changes: { status: { from: 'PENDING', to: 'IN_PROGRESS' } },
    });
  });

  it('marks a cancellation and keeps the reason', () => {
    expect(
      buildStatusMeta(before, {
        ...before,
        status: 'ADMIN_CANCELLED',
        cancellationReason: 'Out of stock',
      }),
    ).toEqual({
      orderNumber: 'ORD-100',
      kind: 'CANCEL',
      changes: { status: { from: 'PENDING', to: 'ADMIN_CANCELLED' } },
      reason: 'Out of stock',
    });
  });

  it('notes the admin notes saved alongside a status change', () => {
    expect(
      buildStatusMeta(before, {
        ...before,
        status: 'IN_PROGRESS',
        adminNotes: 'called',
        cancellationReason: null,
      }),
    ).toMatchObject({ kind: 'STATUS', notesChanged: true });
  });

  it('treats notes-only changes through the status endpoint as notes', () => {
    expect(
      buildStatusMeta(before, {
        ...before,
        adminNotes: 'called',
        cancellationReason: null,
      }),
    ).toEqual({ orderNumber: 'ORD-100', kind: 'NOTES' });
  });

  it('returns null when nothing changed', () => {
    expect(
      buildStatusMeta(before, { ...before, cancellationReason: null }),
    ).toBeNull();
  });
});

describe('buildNotesMeta', () => {
  it('records a notes change without storing the text', () => {
    expect(buildNotesMeta(before, { ...before, adminNotes: 'x' })).toEqual({
      orderNumber: 'ORD-100',
      kind: 'NOTES',
    });
  });

  it('returns null when the notes are unchanged', () => {
    expect(buildNotesMeta(before, { ...before })).toBeNull();
  });
});

describe('buildDeliveryFeeMeta', () => {
  it('records the first price and later changes', () => {
    expect(
      buildDeliveryFeeMeta(before, { ...before, deliveryPrice: '10.00' }),
    ).toEqual({
      orderNumber: 'ORD-100',
      kind: 'DELIVERY_FEE',
      changes: { deliveryPrice: { from: null, to: '10.00' } },
    });
    expect(
      buildDeliveryFeeMeta(
        { ...before, deliveryPrice: '10.00' },
        { ...before, deliveryPrice: '15.00' },
      ),
    ).toMatchObject({
      changes: { deliveryPrice: { from: '10.00', to: '15.00' } },
    });
  });

  it('returns null when the fee did not change', () => {
    expect(
      buildDeliveryFeeMeta(
        { ...before, deliveryPrice: '10.00' },
        { ...before, deliveryPrice: '10.00' },
      ),
    ).toBeNull();
  });
});
