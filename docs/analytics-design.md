# Analytics framework: proposed design

Status: proposal. Nothing here is implemented yet.

## What's there today

- The old `UserVisitRecord` table had no writer after IP tracking was removed (`db85cddc`, 2026-03-28), so its visit counts were frozen. It was dropped in migration `20261126000000_drop_user_visit_record`, and the visit counts were removed from `src/pages/analytics/index.page.tsx`. That page now shows only the user count and Telekom balance, and the new dashboard should replace it.
- There's no chart library. `src/pages/admin/activity/ActivityHeatmap.tsx` is hand-drawn SVG on MUI.
- Three existing pieces are worth reusing: the batch runner (with a retention-job pattern in `scripts/batch-runner/jobs/admin-activity-retention.ts`), the `isStaff` / `isSuperuser` role checks (`src/pages/api/utils/staffAuth.ts`), and SWR.

## Scale and storage: aggregate early, keep raw data briefly

At ~3k monthly users we'll see roughly 10–30k events a day. Even at 100k monthly users it's maybe 300–500k a day. Postgres on this VM (4 CPU / 4 GB RAM / 58 GB disk) handles that comfortably, so this isn't a "massive data" problem yet. The real saving is to **aggregate early and keep raw events only for a short time**. A daily rollup row replaces thousands of raw rows and can be kept forever. Compression codecs matter much less than that.

That's also why we skip ClickHouse, Plausible (which runs on ClickHouse) and Matomo. ClickHouse alone wants most of the 4 GB of RAM. Umami runs on Postgres and would be workable, but it doesn't know about our products, roles or orders, and it adds another process to run. The recommendation is to build it in-house on the existing Postgres.

## How it fits together

```
Browser / WebView ──sendBeacon (batched)──▶ POST /api/events ─┐
API handlers (orders, cart, search) ──trackServer()──────────┤
                                                             ▼
                                      in-memory buffer → multi-row INSERT every ~5s
                                                             ▼
                         AnalyticsEvent (raw, Prisma model, kept 90 days)
                                                             ▼   batch runner: rollup every 10 min + nightly
                         AnalyticsDaily (small rollup table, kept forever)
                         UserOrder ─────────────▶ (revenue metrics read orders directly)
                                                             ▼
          GET /api/admin/analytics?widgets=…  (isStaff; revenue widgets isSuperuser)
                                                             ▼
                         /admin/analytics dashboard (widgets from a registry)
```

## 1. Collection

**Client: `src/lib/analytics/client.ts`**

- Typed calls such as `track('product_view', { productId })`. Events queue in memory and are sent in a single `navigator.sendBeacon` call on `visibilitychange`/`pagehide`, every 30s, or after 20 events. That's about one request per session chunk, which suits slow connections. No third-party script is involved.
- Page views are recorded automatically from Next's `router.events` `routeChangeComplete`.
- Product, category and other pages are served as ISR/static, so the server never sees most views. That's why a client-side beacon is required. Parsing nginx access logs would also miss client-side navigations, and filtering bots out of them is hard.
- It works unchanged inside the mobile WebView. Tag those events `platform=APP` (via the user agent or an injected flag).

**Server: `trackServer()`**

- Called directly in the API handlers for events that must be accurate: `order_placed`, `cart_add`, `search` (with result count), `chat_started`, `signup`. These can't be blocked by ad blockers and can't be faked.

**Orders and revenue**

- Revenue only counts completed orders, and it's attributed to the day the order was completed.
- Revenue, completed-order counts and average order value are **not** summed from events. The rollup reads `UserOrder` directly (`status = 'COMPLETED'`, grouped by the Ashgabat day of `completedAt`). The order table is the source of truth, and an event can't be taken back. Admins can change a total after the order is placed (the delivery fee), and an order can be moved out of `COMPLETED` again. Reading the table also lets us backfill revenue for orders from before tracking existed.
- `totalPrice` is a string holding a TMT amount, so revenue is reported in TMT. The rollup parses it the same way `orderService` does.
- Only one order event is tracked: `order_placed`, carrying just the `orderId`. `UserOrder` doesn't know the analytics visitor or session, so without this event the funnel couldn't connect "viewed product → added to cart" to the order that followed. Whether that order was completed is looked up in `UserOrder` by `orderId` at rollup time, so there's no `order_completed` event, and no totals in the payload that could go stale.

**Identity**

- Visitor: a random first-party cookie `xa_vid` (1 year). This is more accurate than a cookieless hashed-IP ID, which breaks when many users share one carrier NAT IP (common on mobile networks here) and resets every day. Session: 30 minutes of inactivity. Add `userId` when the user is logged in.
- Don't store IPs or IP hashes. Rate limiting in `/api/events` uses the IP in memory only.

## 2. Event catalog (extension point #1)

`src/lib/analytics/events.ts` holds one Zod schema per event name:

```ts
export const events = {
  page_view: z.object({ path: z.string().max(300) }),
  product_view: z.object({ productId: z.string() }),
  search: z.object({ q: z.string().max(100), results: z.number() }),
  cart_add: z.object({ productId: z.string(), qty: z.number() }),
  order_placed: z.object({ orderId: z.string() }), // everything else comes from UserOrder
} as const;

export type EventName = keyof typeof events;
```

The schemas give type safety on the client and validation on the server. Adding a new event is one line here.

## 3. Ingestion: `POST /api/events`

- Why not `/api/analytics` or `/api/track`: ad-blocker filter lists (EasyPrivacy, uBlock) ship generic rules that match paths containing `analytics`, `track`, `collect`, `beacon` and similar, even on first-party domains. `/api/events` is still self-explanatory and doesn't hit those rules. (The admin read API, `/api/admin/analytics`, isn't affected because it isn't loaded by shoppers.)
- Validate against the catalog, drop bots using a user-agent regex (search crawlers hit the ISR pages a lot), cap each batch at 50 events, and rate-limit per visitor.
- Push events into a process-local buffer. Flush every 5s or every 500 events with one multi-row `INSERT` (`createMany`). This keeps the cost to Postgres at almost nothing.
- Trade-off: a crash loses up to 5s of events. That's fine for analytics. If durability is ever needed, append to an NDJSON file and have the batch runner load it, but don't start there.

## 4. Storage

Both tables are ordinary Prisma models in `prisma/schema.prisma`, so they go through `prisma migrate` like everything else. No raw-SQL tables and no partitioning (see "Why no partitions" below).

```prisma
enum AnalyticsPlatform {
  WEB
  APP
}

// Raw events. Kept 90 days, then deleted by the analytics-retention job.
model AnalyticsEvent {
  id          BigInt            @id @default(autoincrement())
  occurredAt  DateTime          @default(now())
  name        String            // an EventName from src/lib/analytics/events.ts
  visitorId   String            @db.Uuid   // the xa_vid cookie
  sessionId   String?           @db.Uuid
  userId      String?           // set when logged in
  entityId    String?           // productId / categoryId: what top-N queries group on
  platform    AnalyticsPlatform
  locale      String            @db.VarChar(2)  // ru, en, tk, tr, ch
  props       Json?             // the rest of the event's payload

  @@index([occurredAt])
  @@index([name, occurredAt])
}

// Daily rollups. Small, kept forever.
model AnalyticsDaily {
  day             DateTime @db.Date      // Asia/Ashgabat calendar day, not UTC
  metric          String                 // a MetricId from the registry
  dimension       String   @default("")  // what the row is broken down by; '' = total
  dimensionValue  String   @default("")  // the value of that breakdown; '' = total
  value           BigInt

  @@id([metric, day, dimension, dimensionValue])
}
```

Example `AnalyticsDaily` rows:

| day        | metric        | dimension | dimensionValue | value  |
| ---------- | ------------- | --------- | -------------- | ------ |
| 2026-11-25 | pageviews     |           |                | 18 240 |
| 2026-11-25 | pageviews     | platform  | APP            | 11 902 |
| 2026-11-25 | pageviews     | locale    | tk             | 4 310  |
| 2026-11-25 | product_views | product   | `<productId>`  | 312    |
| 2026-11-25 | revenue_tmt   |           |                | 84 500 |

**Enum or text.** The rule we follow: a small, closed set that rarely changes is a Postgres enum (`platform`). A set that grows every time we add a feature is text, constrained in TypeScript instead (`name` is typed as `EventName`, `metric` as `MetricId`, both derived from the code registries). Making `name` or `metric` an enum would turn every new event or metric into a migration, and Postgres can't remove an enum value once it's added. `locale` stays a short string because the values read clearly and the list is owned by the i18n config.

**Size estimates.** A raw row with indexes is about 150 bytes.

| Scale                                | Raw data per day | Raw data for 90 days |
| ------------------------------------ | ---------------- | -------------------- |
| 20k events/day (today)               | ~3 MB            | ~300 MB              |
| 300k events/day (100k monthly users) | ~45 MB           | ~4 GB                |

Rollups stay in the megabytes for years.

**Retention.** Raw events are kept for 90 days. A nightly `analytics-retention` job deletes older rows in batches, the same way `admin-activity-retention` already does. At today's volume that's ~20k rows a night, which autovacuum handles without trouble.

**Why no partitions.** Partitioning would make deletes free (drop a whole month), but it costs more than it saves at this scale:

- Prisma can't declare partitioned tables, so the table would have to live outside `schema.prisma`. The next `prisma migrate dev` would then see a table it doesn't know about and generate a `DROP TABLE` for it. The monthly partitions the batch runner creates would also show up as drift in local databases and trigger reset prompts.
- The workaround (putting the tables in a separate Postgres schema that Prisma ignores, and querying them with `$queryRaw`) works, but it means hand-written SQL and no generated types.

Revisit this if raw volume heads towards a few hundred thousand events a day and the nightly delete gets slow. Moving to a partitioned table then is a one-off migration.

**If more compression is needed later:**

- **TimescaleDB** columnar compression gives 10–20x on raw data. Whether that's possible depends on installing the extension offline on the VM.
- **Archive old rows to Parquet** with DuckDB (zstd, about 10x) before deleting them, if raw history is wanted for ad-hoc analysis.

**Unique visitors.** These can't be summed: daily uniques don't add up to monthly uniques. Store them as separate metrics (`visitors_day`, `visitors_week`, `visitors_month`, with `day` = the start of the period), or compute them from raw data inside the 90-day window. At this scale an exact `COUNT(DISTINCT)` is fine, so HyperLogLog isn't needed.

## 5. Rollup jobs (batch runner)

Three jobs, registered in `scripts/batch-runner/jobs/registry.ts`:

- `analytics-rollup`: every 10 minutes, recompute **today** and upsert it. The job is idempotent, so reruns are safe.
- Nightly: finalize yesterday, plus the weekly and monthly uniques.
- `analytics-retention`: delete raw events older than 90 days, in batches. Same pattern as `admin-activity-retention`.

## 6. Metric registry (extension point #2)

Each metric is one file in `src/lib/analytics/metrics/`:

```ts
export const topProducts: MetricDef = {
  id: 'product_views',
  kind: 'topN', // 'timeseries' | 'topN' | 'kpi' | 'funnel'
  access: 'staff', // 'staff' (ADMIN + SUPERUSER) | 'superuser'
  rollup: sql`INSERT INTO "AnalyticsDaily" … SELECT day, 'product_views', 'product', "entityId", count(*) … GROUP BY 1,4`,
  query: ({ from, to, limit }) => /* SELECT "dimensionValue", sum(value) … ORDER BY 2 DESC LIMIT $limit */,
  enrich: async (rows) => /* join product names/images from Prisma */,
  labelKey: 'analytics.topProducts', // translation key, must exist in all 5 locales
};

export type MetricId = (typeof metrics)[number]['id'];
```

The rollup job loops over the registry and runs each metric's `rollup`. The API and dashboard loop over it too. Adding an analytic means one event (if it needs a new one), one metric file and one translation key.

**Access.** Revenue metrics (`revenue_tmt`, average order value, revenue by product) have `access: 'superuser'`. Everything else has `access: 'staff'`. The API checks this per widget, so an admin requesting a superuser widget gets it left out of the response, and the dashboard hides widgets the viewer can't see.

## 7. Reading and the dashboard

- **API:** `GET /api/admin/analytics?widgets=visits,product_views&from=…&to=…&granularity=day|week|month`, behind `withAuth` + `isStaff`, plus the per-widget `access` check above. It returns every widget in one response, which keeps client round-trips to one. Cache results in memory for about 60s, keyed by role as well as the query.
- **Page:** `/admin/analytics` replaces the old `/analytics` page. It has a date-range picker and a grid of widgets rendered by `kind`.
- **Charts:** `@mui/x-charts` (matches MUI, bundled, no CDN), loaded with `next/dynamic` on admin pages only so it never ships to shoppers. The lighter option is uPlot (~45 KB).

## 8. Starter metrics, in priority order

1. Visitors, sessions and page views over time, split by web and app.
2. Top N viewed products and top categories.
3. Top searches and **searches with zero results**. These are usually the most useful for a shop: they show what customers want and we don't stock.
4. Funnel: product view → add to cart → order placed → order completed, with conversion rates per step. The last step joins `order_placed` events to `UserOrder` by `orderId`.
5. Revenue (superuser only): completed-order revenue in TMT over time, number of completed orders, and average order value.
6. Breakdowns by locale and device, and the top referrer domains.

## Rollout

1. Prisma models and migration, `/api/events`, the client tracker and auto page views.
2. Rollup and retention jobs, the registry, the admin API, and the visits chart plus top products. Retire the old `/analytics` page.
3. Server events (orders, cart, search), the funnel, revenue widgets and the zero-result searches widget.
4. Optional: TimescaleDB or Parquet archiving, and a CSV export.

## Decisions

- **Raw event retention:** 90 days.
- **Visitor ID:** first-party cookie `xa_vid`.
- **Access:** revenue metrics are superuser-only. All other metrics are visible to admins and superusers (`isStaff`).
- **Revenue:** completed orders only, read from `UserOrder`, in TMT, counted on the day the order was completed.

Related: stale `completedAt` after an order leaves `COMPLETED` is tracked in #505. It doesn't affect analytics, because the revenue rollup filters on `status` too.
