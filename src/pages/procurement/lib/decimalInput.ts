/**
 * Decimal text-field helpers for prices and rates. Russian keyboards type ","
 * as the decimal separator, so both "," and "." are accepted.
 */

/** True while `text` is something a user can be halfway through typing ("", "3", "3.", "3,6", ".5"). */
export function isDecimalDraft(text: string): boolean {
  return /^\d*([.,]\d*)?$/.test(text);
}

/** "3,67" -> 3.67, "3." -> 3; empty or unparsable -> undefined. */
export function parseDecimal(text: string): number | undefined {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '' || normalized === '.') return undefined;
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : undefined;
}
