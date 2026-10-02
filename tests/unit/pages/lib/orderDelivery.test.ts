import {
  DELIVERY_FEE_ITEM_NAME,
  deliveryFeeLabel,
  isClosedOrder,
  isPickupAddress,
  isPickupOrder,
  orderDeliveryFee,
  orderItemsSubtotal,
  PICKUP_ADDRESS,
  splitDeliveryFee,
} from '@/pages/lib/orderDelivery';
import { describe, expect, it } from 'vitest';

describe('order delivery helpers', () => {
  const items = [
    { productName: 'A', productPrice: '100.50', quantity: 2 },
    { productName: 'B', productPrice: '49', quantity: 1 },
  ];
  const open = { deliveryAddress: 'Main st 1', status: 'PENDING' };
  const t = (key: string) => key;

  it('sums the item snapshots', () => {
    expect(orderItemsSubtotal(items)).toBeCloseTo(250);
  });

  it('moves the fee line out of the items', () => {
    const feeLine = {
      productName: DELIVERY_FEE_ITEM_NAME,
      productPrice: '0.00',
      quantity: 1,
    };
    expect(splitDeliveryFee({ items: [...items, feeLine] })).toEqual({
      items,
      deliveryPrice: '0.00',
    });
    expect(splitDeliveryFee({ items })).toEqual({
      items,
      deliveryPrice: null,
    });
  });

  it('tells an unpriced delivery from a free one', () => {
    expect(orderDeliveryFee({ ...open, deliveryPrice: null })).toBeNull();
    expect(orderDeliveryFee({ ...open, deliveryPrice: '0.00' })).toBe(0);
    expect(orderDeliveryFee({ ...open, deliveryPrice: '25.50' })).toBeCloseTo(
      25.5,
    );
  });

  it('treats pickup and never-priced closed orders as free', () => {
    expect(
      orderDeliveryFee({ deliveryAddress: PICKUP_ADDRESS, status: 'PENDING' }),
    ).toBe(0);
    expect(
      orderDeliveryFee({ deliveryAddress: 'Main st 1', status: 'COMPLETED' }),
    ).toBe(0);
  });

  it('labels unpriced, free and priced delivery', () => {
    expect(deliveryFeeLabel(open, t)).toBe('deliveryPriceToBeConfirmed');
    expect(deliveryFeeLabel({ ...open, deliveryPrice: '0' }, t)).toBe('free');
    expect(deliveryFeeLabel({ ...open, deliveryPrice: '15' }, t)).toBe(
      '15.00 manat',
    );
  });

  it('recognises pickup and closed orders', () => {
    expect(isPickupOrder({ deliveryAddress: PICKUP_ADDRESS })).toBe(true);
    expect(isPickupOrder({ deliveryAddress: 'Main st 1' })).toBe(false);
    expect(isPickupAddress(' pickup ')).toBe(true);
    expect(isClosedOrder({ status: 'COMPLETED' })).toBe(true);
    expect(isClosedOrder({ status: 'ADMIN_CANCELLED' })).toBe(true);
    expect(isClosedOrder({ status: 'IN_PROGRESS' })).toBe(false);
  });
});
