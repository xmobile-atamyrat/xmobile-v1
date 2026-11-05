/** Longest quantity we accept (keeps the 88px field readable). */
export const MAX_QUANTITY_DIGITS = 6;

/**
 * Turns what the user typed into a quantity: digits only (a phone number pad
 * can still paste "12 шт" or "1,5"), `null` while the field is empty.
 */
export function parseQuantityInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, '').slice(0, MAX_QUANTITY_DIGITS);
  return digits === '' ? null : parseInt(digits, 10);
}

/** Empty and 0 quantities are skipped when the supplier files are built. */
export function isMissingQuantity(quantity: number | null | undefined) {
  return quantity == null || quantity === 0;
}
