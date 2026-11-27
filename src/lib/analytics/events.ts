import { z } from 'zod';

/**
 * Event catalog (extension point #1 in docs/analytics-design.md).
 *
 * One Zod schema per event name. The client tracker and `trackServer()` are
 * typed from it, and `POST /api/events` validates against it. Adding an event
 * is one entry here (plus `entityKey` if top-N queries should group on it).
 */
export const events = {
  // Client events: sent by the browser / WebView beacon.
  page_view: z.object({
    path: z.string().max(300),
    // Host of an external document.referrer, e.g. 'google.com'. Omitted for
    // internal navigation and direct visits.
    referrer: z.string().max(200).optional(),
    device: z.enum(['mobile', 'tablet', 'desktop']).optional(),
  }),
  product_view: z.object({ productId: z.string().min(1).max(64) }),
  category_view: z.object({ categoryId: z.string().min(1).max(64) }),

  // Server events: only `trackServer()` may record these, so they can't be
  // blocked or faked.
  search: z.object({
    q: z.string().max(100),
    results: z.number().int().min(0),
  }),
  cart_add: z.object({
    productId: z.string().min(1).max(64),
    qty: z.number().int().min(1),
  }),
  // Everything else about the order (status, total) is read from UserOrder.
  order_placed: z.object({ orderId: z.string().min(1).max(64) }),
  chat_started: z.object({}),
  signup: z.object({}),
} as const;

export type EventName = keyof typeof events;
export type EventProps<N extends EventName> = z.infer<(typeof events)[N]>;

/** Events the browser may send to `POST /api/events`. */
export const CLIENT_EVENT_NAMES = [
  'page_view',
  'product_view',
  'category_view',
] as const satisfies readonly EventName[];
export type ClientEventName = (typeof CLIENT_EVENT_NAMES)[number];

/** Events only the server records, via `trackServer()`. */
export const SERVER_EVENT_NAMES = [
  'search',
  'cart_add',
  'order_placed',
  'chat_started',
  'signup',
] as const satisfies readonly EventName[];
export type ServerEventName = (typeof SERVER_EVENT_NAMES)[number];

/**
 * Which prop is copied into `AnalyticsEvent.entityId`, the column top-N
 * queries group on. Events without an entry store `entityId = null`.
 */
export const entityKey: Partial<Record<EventName, string>> = {
  product_view: 'productId',
  category_view: 'categoryId',
  cart_add: 'productId',
  order_placed: 'orderId',
};

export const isEventName = (value: unknown): value is EventName =>
  typeof value === 'string' && Object.hasOwn(events, value);

export const isClientEventName = (value: unknown): value is ClientEventName =>
  (CLIENT_EVENT_NAMES as readonly string[]).includes(value as string);

/** Splits validated props into the `entityId` column and the `props` JSON. */
export function splitEntity(
  name: EventName,
  props: Record<string, unknown>,
): { entityId: string | null; props: Record<string, unknown> | null } {
  const key = entityKey[name];
  const rest = { ...props };
  let entityId: string | null = null;
  if (key && typeof rest[key] === 'string') {
    entityId = rest[key] as string;
    delete rest[key];
  }
  return { entityId, props: Object.keys(rest).length > 0 ? rest : null };
}
