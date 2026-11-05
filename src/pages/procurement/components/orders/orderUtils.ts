import { ProcurementOrder } from '@prisma/client';

/** "02.11.2026" in the viewer's local time (same format in every locale). */
export function formatOrderDate(value: Date | string): string {
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

/** Newest first, like the server, but also after local creates/renames. */
export function sortOrdersNewestFirst(
  orders: ProcurementOrder[],
): ProcurementOrder[] {
  return [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** Case-insensitive name filter for the orders search field. */
export function filterOrders(
  orders: ProcurementOrder[],
  query: string,
): ProcurementOrder[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === '') return orders;
  return orders.filter((order) =>
    order.name.toLocaleLowerCase().includes(needle),
  );
}

/**
 * Default name for a new order: today's date, with " (2)", " (3)"... when an
 * order with that name already exists.
 */
export function suggestOrderName(
  orders: ProcurementOrder[],
  now: Date = new Date(),
): string {
  const base = formatOrderDate(now);
  const taken = new Set(orders.map((order) => order.name.trim()));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} (${n})`)) n += 1;
  return `${base} (${n})`;
}
