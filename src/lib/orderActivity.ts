import { logAdminActivity } from '@/lib/adminActivity';
import dbClient from '@/lib/dbClient';
import { splitDeliveryFee } from '@/pages/lib/orderDelivery';
import type { Prisma, UserOrderStatus } from '@prisma/client';

export type OrderSnapshot = {
  orderNumber: string;
  status: UserOrderStatus;
  adminNotes: string | null;
  deliveryPrice: string | null;
};

/**
 * The order as it was before an admin change, which the order services don't
 * hand back. Never throws: a failed read only means this change goes unlogged.
 */
export async function snapshotOrder(
  orderId: string,
): Promise<OrderSnapshot | null> {
  try {
    const order = await dbClient.userOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (order == null) return null;
    const { deliveryPrice } = splitDeliveryFee(order);
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      adminNotes: order.adminNotes,
      deliveryPrice,
    };
  } catch {
    return null;
  }
}

export function buildStatusMeta(
  before: OrderSnapshot,
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
  before: OrderSnapshot,
  after: Pick<OrderSnapshot, 'orderNumber' | 'adminNotes'>,
): Prisma.InputJsonObject | null {
  if ((before.adminNotes ?? '') === (after.adminNotes ?? '')) return null;
  return { orderNumber: after.orderNumber, kind: 'NOTES' };
}

export function buildDeliveryFeeMeta(
  before: OrderSnapshot,
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
    targetId: orderId,
    meta,
  });
}
