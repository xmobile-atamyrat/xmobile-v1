import {
  DELIVERY_FEE_ITEM_NAME,
  DELIVERY_PRICING_START,
  deliveryFeeLabel,
  isClosedOrder,
  isPickupAddress,
  isPickupOrder,
  orderDeliveryFee,
  orderItemsSubtotal,
  PICKUP_ADDRESS,
  showDeliveryFee,
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

  it('treats delivery orders placed before paid delivery as free', () => {
    const before = new Date(DELIVERY_PRICING_START.getTime() - 1);
    const after = new Date(DELIVERY_PRICING_START.getTime() + 1);
    expect(orderDeliveryFee({ ...open, createdAt: before })).toBe(0);
    expect(
      orderDeliveryFee({ ...open, createdAt: before.toISOString() }),
    ).toBe(0);
    expect(orderDeliveryFee({ ...open, createdAt: after })).toBeNull();
    // A price an admin set still wins over the old default
    expect(
      orderDeliveryFee({ ...open, createdAt: before, deliveryPrice: '10' }),
    ).toBe(10);
  });

  it('hides the fee of a cancelled delivery that was never priced', () => {
    const cancelled = { deliveryAddress: 'Main st 1', status: 'USER_CANCELLED' };
    expect(showDeliveryFee(cancelled)).toBe(false);
    expect(showDeliveryFee({ ...cancelled, status: 'ADMIN_CANCELLED' })).toBe(
      false,
    );
    expect(showDeliveryFee({ ...cancelled, deliveryPrice: '20' })).toBe(true);
    expect(
      showDeliveryFee({ ...cancelled, deliveryAddress: PICKUP_ADDRESS }),
    ).toBe(true);
    expect(showDeliveryFee(open)).toBe(true);
    expect(showDeliveryFee({ ...open, status: 'COMPLETED' })).toBe(true);
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
