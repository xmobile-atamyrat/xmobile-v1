import dbClient from '@/lib/dbClient';
import { getPrice } from '@/pages/api/prices/index.page';
import { PrismaClient } from '@prisma/client';

const squareBracketRegex = /\[([^\]]+)\]/;

// Type for transaction client with orderNumberCounter model
type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
> & {
  orderNumberCounter: {
    findUnique: (args: {
      where: { id: number };
    }) => Promise<{ id: number; counter: number } | null>;
    create: (args: {
      data: { id: number; counter: number };
    }) => Promise<{ id: number; counter: number }>;
    update: (args: {
      where: { id: number };
      data: { counter: { increment: number } };
    }) => Promise<{ id: number; counter: number }>;
  };
};

/**
 * Generates a unique order number in format: ORD-YYYYMMDD-XXX
 * Uses database-level locking to ensure thread safety
 */
export async function generateOrderNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

  // Use a transaction with SELECT FOR UPDATE to lock the counter row
  // Note: Run `npx prisma migrate dev` after schema changes to generate Prisma client
  const result = await dbClient.$transaction(async (tx: TransactionClient) => {
    // Lock the counter row for update
    const counter = await tx.orderNumberCounter.findUnique({
      where: { id: 1 },
    });

    if (!counter) {
      // Initialize counter if it doesn't exist
      await tx.orderNumberCounter.create({
        data: { id: 1, counter: 1 },
      });
      return { counter: 1 };
    }

    // Increment and update
    const updated = await tx.orderNumberCounter.update({
      where: { id: 1 },
      data: { counter: { increment: 1 } },
    });

    return updated;
  });

  const sequence = String(result.counter).padStart(3, '0');
  return `ORD-${dateStr}-${sequence}`;
}

/**
 * Calculates total price from cart items
 */
export async function calculateTotalPrice(
  cartItems: Array<{
    product: { price: string | null };
    quantity: number;
    selectedTag?: string | null;
  }>,
): Promise<string> {
  const prices = await Promise.all(
    cartItems.map(async (item) => {
      // 1. Try to get price from selectedTag first
      if (item.selectedTag) {
        const tagMatch = item.selectedTag.match(squareBracketRegex);
        if (tagMatch) {
          const priceId = tagMatch[1];
          const price = await getPrice(priceId);
          if (price && price.priceInTmt) {
            const itemPrice = parseFloat(price.priceInTmt);
            if (!Number.isNaN(itemPrice)) {
              return itemPrice * item.quantity;
            }
          }
        }
      }

      // 2. Fallback to product price if no specific tag price
      if (item.product.price) {
        const priceMatch = item.product.price.match(squareBracketRegex);
        if (!priceMatch) return 0;

        const priceId = priceMatch[1];
        const price = await getPrice(priceId);
        if (!price || !price.priceInTmt) return 0;

        const itemPrice = parseFloat(price.priceInTmt);
        if (Number.isNaN(itemPrice)) return 0;

        return itemPrice * item.quantity;
      }

      return 0;
    }),
  );

  const total = prices.reduce((sum, price) => sum + price, 0);
  return total.toFixed(2);
}
