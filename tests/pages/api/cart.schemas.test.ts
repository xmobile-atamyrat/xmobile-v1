import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * Mirrors `src/pages/api/cart.page.ts` — keep in sync when cart validation changes.
 */
const FormSchema = z.object({
  cartItemId: z.string(),
  productId: z.string(),
  quantity: z.number(),
});

const CreateCartItem = FormSchema.omit({ cartItemId: true });
const EditCartItem = FormSchema.omit({ productId: true });

describe('cart API zod shapes', () => {
  it('CreateCartItem requires productId and quantity', () => {
    expect(CreateCartItem.parse({ productId: 'p1', quantity: 2 })).toEqual({
      productId: 'p1',
      quantity: 2,
    });
    expect(CreateCartItem.safeParse({ quantity: 1 }).success).toBe(false);
  });

  it('EditCartItem requires cartItemId and quantity', () => {
    expect(EditCartItem.parse({ cartItemId: 'c1', quantity: 3 })).toEqual({
      cartItemId: 'c1',
      quantity: 3,
    });
  });

  it('rejects non-numeric quantity', () => {
    expect(
      CreateCartItem.safeParse({ productId: 'p', quantity: '2' }).success,
    ).toBe(false);
  });
});
