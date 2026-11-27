/**
 * Postgres rejects `\u0000` in `text` and `jsonb`, and a lone UTF-16
 * surrogate in `jsonb`. One such value fails the whole multi-row insert it is
 * part of, so every string from a request is cleaned before it is queued.
 */

// A high surrogate not followed by a low one, or a low one not preceded by a
// high one. (`String.prototype.toWellFormed` does the same, but TypeScript's
// lib in this repo doesn't declare it yet.)
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Drops NUL characters and replaces lone surrogates with U+FFFD. */
export function sanitizeString(value: string): string {
  return value.replaceAll('\u0000', '').replace(LONE_SURROGATE, '�');
}

/** Nesting deeper than this is cut off; event props are flat. */
const MAX_DEPTH = 8;

/**
 * `value` with every string in it (object keys too) passed through
 * `sanitizeString`. Other values are returned as they are.
 */
export function sanitizeValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return sanitizeString(value);
  if (value == null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return null;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    out[sanitizeString(key)] = sanitizeValue(item, depth + 1);
  });
  return out;
}

/**
 * The first `max` UTF-16 units of `value`, one fewer when the cut would split
 * a surrogate pair (so the result is never ill-formed).
 */
export function truncateUtf16(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}
