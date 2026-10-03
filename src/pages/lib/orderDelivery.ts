export const DELIVERY_METHODS = ['PICKUP', 'DELIVERY'] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

// Pickup orders have no address, so this marker is stored in
// `UserOrder.deliveryAddress` instead of adding a column.
export const PICKUP_ADDRESS = 'PICKUP';

// The delivery fee is stored as its own `UserOrderItem` line under this name
// (no product), so "free" (a 0.00 line) differs from "not priced yet" (none).
export const DELIVERY_FEE_ITEM_NAME = '__delivery_fee__';

export const MAX_DELIVERY_DAYS = 5;

export const isPickupAddress = (address: string) =>
  address.trim().toUpperCase() === PICKUP_ADDRESS;

export const isPickupOrder = (order: { deliveryAddress: string }) =>
  order.deliveryAddress === PICKUP_ADDRESS;

export const isClosedOrder = (order: { status: string }) =>
  ['COMPLETED', 'USER_CANCELLED', 'ADMIN_CANCELLED'].includes(order.status);

export const isDeliveryFeeItem = (item: { productName: string }) =>
  item.productName === DELIVERY_FEE_ITEM_NAME;

export const splitDeliveryFee = <
  T extends { items: Array<{ productName: string; productPrice: string }> },
>(
  order: T,
): T & { deliveryPrice: string | null } => {
  const feeItem = order.items.find(isDeliveryFeeItem);
  return {
    ...order,
    items: order.items.filter((item) => !isDeliveryFeeItem(item)),
    deliveryPrice: feeItem ? feeItem.productPrice : null,
  };
};

export const orderItemsSubtotal = (
  items: Array<{ productPrice: string; quantity: number }>,
) =>
  items.reduce(
    (acc, item) => acc + (parseFloat(item.productPrice) || 0) * item.quantity,
    0,
  );

// Orders placed before paid delivery shipped were promised free delivery and
// never get a fee line. Set this to the day the delivery options go live.
export const DELIVERY_PRICING_START = new Date('2026-10-03T00:00:00+05:00');

type OrderDelivery = {
  deliveryAddress: string;
  deliveryPrice?: string | null;
  status: string;
  createdAt?: Date | string;
};

const isPreDeliveryPricingOrder = (order: OrderDelivery) =>
  order.createdAt != null &&
  new Date(order.createdAt).getTime() < DELIVERY_PRICING_START.getTime();

const isCancelledOrder = (order: { status: string }) =>
  ['USER_CANCELLED', 'ADMIN_CANCELLED'].includes(order.status);

// null while an open delivery order still waits for an admin to price it;
// older orders and closed orders that were never priced were free
export const orderDeliveryFee = (order: OrderDelivery): number | null => {
  if (isPickupOrder(order)) return 0;
  if (order.deliveryPrice != null) return parseFloat(order.deliveryPrice) || 0;
  if (isPreDeliveryPricingOrder(order) || isClosedOrder(order)) return 0;
  return null;
};

// A cancelled delivery that was never priced has no fee worth showing
export const showDeliveryFee = (order: OrderDelivery) =>
  isPickupOrder(order) ||
  order.deliveryPrice != null ||
  !isCancelledOrder(order);

export const deliveryFeeLabel = (
  order: OrderDelivery,
  t: (key: string) => string,
) => {
  const fee = orderDeliveryFee(order);
  if (fee === null) return t('deliveryPriceToBeConfirmed');
  if (fee === 0) return t('free');
  return `${fee.toFixed(2)} ${t('manat')}`;
};
