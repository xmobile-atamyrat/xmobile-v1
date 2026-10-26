import { logAdminActivity } from '@/lib/adminActivity';
import type { Prisma, UserOrderStatus } from '@prisma/client';

export type OrderSnapshot = {
  orderNumber: string;
  status: UserOrderStatus;
  adminNotes: string | null;
  deliveryPrice: string | null;
};

/**
 * The builders take the order as the service read it under its row lock, so
 * "before" is what this save replaced even when two admins save at once.
 */
export function buildStatusMeta(
  before: Pick<OrderSnapshot, 'status' | 'adminNotes'>,
  after: Omit<OrderSnapshot, 'deliveryPrice'> & {
    cancellationReason: string | null;
  },
): Prisma.InputJsonObject | null {
  const statusChanged = before.status !== after.status;
  const notesChanged = (before.adminNotes ?? '') !== (after.adminNotes ?? '');
  if (!statusChanged) {
    return notesChanged
      ? { orderNumber: after.orderNumber, kind: 'NOTES' }
      : null;
  }
  const cancelled = after.status === 'ADMIN_CANCELLED';
  return {
    orderNumber: after.orderNumber,
    kind: cancelled ? 'CANCEL' : 'STATUS',
    changes: { status: { from: before.status, to: after.status } },
    ...(cancelled && after.cancellationReason
      ? { reason: after.cancellationReason }
      : {}),
    ...(notesChanged ? { notesChanged: true } : {}),
  };
}

/** Notes can be long and personal; the log records that they changed, not what they said. */
export function buildNotesMeta(
  before: Pick<OrderSnapshot, 'adminNotes'>,
  after: Pick<OrderSnapshot, 'orderNumber' | 'adminNotes'>,
): Prisma.InputJsonObject | null {
  if ((before.adminNotes ?? '') === (after.adminNotes ?? '')) return null;
  return { orderNumber: after.orderNumber, kind: 'NOTES' };
}

export function buildDeliveryFeeMeta(
  before: Pick<OrderSnapshot, 'deliveryPrice'>,
  after: Pick<OrderSnapshot, 'orderNumber' | 'deliveryPrice'>,
): Prisma.InputJsonObject | null {
  if (before.deliveryPrice === after.deliveryPrice) return null;
  return {
    orderNumber: after.orderNumber,
    kind: 'DELIVERY_FEE',
    changes: {
      deliveryPrice: { from: before.deliveryPrice, to: after.deliveryPrice },
    },
  };
}

export function recordOrderActivity(
  userId: string | undefined,
  orderId: string,
  meta: Prisma.InputJsonObject | null,
): void {
  if (meta == null) return;
  logAdminActivity({
    userId,
    entity: 'ORDER',
    action: 'UPDATE',
    entityId: orderId,
    meta,
  });
}
