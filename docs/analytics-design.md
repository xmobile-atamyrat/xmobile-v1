# Analytics framework: design

Status: implemented on `feat/analytics-framework`. This doc describes what was built; where the build differs from the original proposal, the build wins.

## Background

- The old `UserVisitRecord` table had no writer after IP tracking was removed (`db85cddc`, 2026-03-28), so its visit counts were frozen. It was dropped in migration `20261126000000_drop_user_visit_record`. The old `/analytics` page (user count and Telekom balance) now redirects to the new `/admin/analytics` dashboard, which shows both.
- The framework reuses the batch runner (and the retention-job pattern of `admin-activity-retention`), the `isStaff` / `isSuperuser` role checks (`src/pages/api/utils/staffAuth.ts`), and SWR. Charts use `@mui/x-charts`.

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

- Typed calls such as `track('product_view', { productId })`. Events queue in memory and are sent in a single `navigator.sendBeacon` call (JSON blob, `fetch` with `keepalive` as fallback) on `visibilitychange` → hidden, on `pagehide`, 30s after the first queued event, or at 20 queued events. No timer runs while the queue is empty. Batches are split at 50 events. That's about one request per session chunk, which suits slow connections. No third-party script is involved.
- Page views are recorded automatically: one for the initial load and one per `routeChangeComplete`, deduped on locale + path (query-only and hash changes don't count; switching language does). `path` has no locale prefix, query or hash. The first page view of a load carries the external `referrer` host; every page view carries `device` (mobile / tablet / desktop).
- `product_view` and `category_view` are sent from the product and category pages (`useProductView`, `useCategoryView`).
- Staff-only routes (`/admin`, `/analytics`, `/server-logs`, `/procurement`, `/orders/admin`, the product and category admin tools) are never tracked.
- Product, category and other pages are served as ISR/static, so the server never sees most views. That's why a client-side beacon is required. Parsing nginx access logs would also miss client-side navigations, and filtering bots out of them is hard.
- It works unchanged inside the mobile WebView. The client tags those events `platform=APP` using `isWebView()`. Server events detect the app from the user agent (Android `; wv)`, or iOS WebKit without `Safari/`). Recommended follow-up in `mobile/`: set `applicationNameForUserAgent="XMobileApp/<version>"` on the WebView; `detectPlatform` already recognises it.

**Server: `trackServer()`**

- Called directly in the API handlers for events that must be accurate: `order_placed`, `cart_add`, `search` (with result count), `chat_started`, `signup`. These can't be blocked by ad blockers and can't be faked. `trackServer()` is fire-and-forget: it never throws and never waits on the database.
- `cart_add` means a new line in the cart (logged-in or guest), not a quantity change.
- `search` is recorded for page 1 of a storefront product search. The home page searches as you type, so each visitor's search is held for 3s and replaced by their next one: only the term they stopped on counts. The same visitor repeating the same term within 30 minutes (a sort or filter change) isn't counted again. Queries are trimmed, lower-cased and capped at 100 characters. Searches rendered on the server (`/?q=` on first load) aren't tracked.
- `order_placed` is sent for logged-in and guest checkout, `chat_started` when a new chat session is created, `signup` when an account is created.

**Staff are excluded.** No events are recorded for ADMIN or SUPERUSER users, so staff browsing the shop doesn't skew the numbers. `/api/events` and `trackServer()` look up the user's current role (cached for a few minutes) and drop staff events.

**Orders and revenue**

- Revenue only counts completed orders, and it's attributed to the day the order was completed.
- Revenue, completed-order counts and average order value are **not** summed from events. The rollup reads `UserOrder` directly (`status = 'COMPLETED'`, grouped by the Ashgabat day of `completedAt`). The order table is the source of truth, and an event can't be taken back. Admins can change a total after the order is placed (the delivery fee), and an order can be moved out of `COMPLETED` again. Reading the table also lets us backfill revenue for orders from before tracking existed.
- `totalPrice` is a string holding a TMT amount, so revenue is reported in TMT. The rollup parses it the same way `orderService` does.
- Only one order event is tracked: `order_placed`, carrying just the `orderId`. `UserOrder` doesn't know the analytics visitor or session, so without this event the funnel couldn't connect "viewed product → added to cart" to the order that followed. Whether that order was completed is looked up in `UserOrder` by `orderId` at rollup time, so there's no `order_completed` event, and no totals in the payload that could go stale.

**Identity**

- Visitor: a random first-party cookie `xa_vid` (1 year). This is more accurate than a cookieless hashed-IP ID, which breaks when many users share one carrier NAT IP (common on mobile networks here) and resets every day. Session: 30 minutes of inactivity. Add `userId` when the user is logged in.
- Both cookies are set by the client (`Path=/; SameSite=Lax`, `Secure` on https) and read by the server. Events without a valid `xa_vid` are dropped.
- Don't store IPs or IP hashes. Rate limiting in `/api/events` uses the IP in memory only.

## 2. Event catalog (extension point #1)

`src/lib/analytics/events.ts` holds one Zod schema per event name:

```ts
export const events = {
  // Client events (POST /api/events)
  page_view: z.object({ path, referrer?, device? }),
  product_view: z.object({ productId }),
  category_view: z.object({ categoryId }),
  // Server events (trackServer only)
  search: z.object({ q, results }),
  cart_add: z.object({ productId, qty }),
  order_placed: z.object({ orderId }), // everything else comes from UserOrder
  chat_started: z.object({}),
  signup: z.object({}),
} as const;
```

`CLIENT_EVENT_NAMES` lists the events the browser may send; the rest are server-only and `/api/events` drops them. `entityKey` says which prop goes into the `entityId` column. The schemas give type safety on the client and validation on the server. Adding a new event is one entry here.

## 3. Ingestion: `POST /api/events`

- Why not `/api/analytics` or `/api/track`: ad-blocker filter lists (EasyPrivacy, uBlock) ship generic rules that match paths containing `analytics`, `track`, `collect`, `beacon` and similar, even on first-party domains. `/api/events` is still self-explanatory and doesn't hit those rules. (The admin read API, `/api/admin/analytics`, isn't affected because it isn't loaded by shoppers.)
- Body: `{ platform: 'WEB' | 'APP', locale, events: [{ name, props, ts }] }`. Identity comes only from the cookies, and `userId` from the refresh-token cookie (beacons carry no `Authorization` header).
- Validate against the catalog and drop invalid or server-only events one by one. Drop bots using a user-agent regex (search crawlers hit the ISR pages a lot). The client `ts` is used only if it's within the last hour (and no more than a minute ahead), otherwise server time.
- Responses: 204 on success, and also when the batch is dropped on purpose (bot, no visitor cookie, staff); 400 for a malformed body or more than 50 events; 429 when rate-limited (60 requests/min per visitor, plus a per-IP cap); 405 for other methods. Body limit 64 KB.
- Push events into a process-local buffer. Flush every 5s or every 500 events with one multi-row `INSERT` (`createMany`). This keeps the cost to Postgres at almost nothing. The buffer holds at most 5000 rows; past that, new events are dropped with one warning, so a database outage can't grow memory.
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

| day        | metric        | dimension | dimensionValue | value     |
| ---------- | ------------- | --------- | -------------- | --------- |
| 2026-11-25 | pageviews     |           |                | 18 240    |
| 2026-11-25 | pageviews     | platform  | APP            | 11 902    |
| 2026-11-25 | pageviews     | locale    | tk             | 4 310     |
| 2026-11-25 | product_views | product   | `<productId>`  | 312       |
| 2026-11-25 | revenue_tmt   |           |                | 8 450 000 |

`revenue_tmt` is stored in hundredths of a manat (the example is 84 500 TMT), because `value` is an integer.

The full list of stored metrics and their dimensions is in the header of `src/lib/analytics/rollup.ts`. Stored metric names aren't widget ids: one stored series can feed several widgets.

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

**Unique visitors.** These can't be summed: daily uniques don't add up to monthly uniques. They're stored as separate metrics (`visitors`, `visitors_week`, `visitors_month`, with `day` = the start of the period). For a range inside the 90-day raw window, the dashboard counts them exactly with `COUNT(DISTINCT)` on raw events. For older ranges it shows an upper bound (the smaller of the summed daily uniques and the stored week/month rows). Sessions work the same way. At this scale an exact `COUNT(DISTINCT)` is fine, so HyperLogLog isn't needed.

## 5. Rollup jobs (batch runner)

Three jobs, registered in `scripts/batch-runner/jobs/registry.ts`:

- `analytics-rollup`: every 10 minutes (and once at start-up), recompute **today**, plus yesterday during the first hour after Ashgabat midnight so late events land.
- `analytics-rollup-nightly`: 01:30 Asia/Ashgabat. Finalizes yesterday, computes the weekly and monthly uniques, and recomputes the order-based metrics (revenue, completed orders, funnel) for every day in the raw window, so status changes on older orders show up.
- `analytics-retention`: 04:30 Asia/Ashgabat. Deletes raw events older than 90 days, in batches. Same pattern as `admin-activity-retention`.

Each rollup replaces one day's rows for its metrics in a single transaction, under an advisory lock, so reruns and overlapping runs are safe. Days older than the raw window only get their order-based metrics recomputed, so pruned days aren't overwritten with zeros.

## 6. Metric registry (extension point #2)

Two pieces:

- **`src/lib/analytics/metrics/catalog.ts`** lists every dashboard widget in display order: `{ id, kind, access, unit, labelKey }`, where `kind` is `kpi | timeseries | topN | funnel` and `unit` is `count | tmt | percent` (percent values are 0–100).
- **`src/lib/analytics/metrics/*.ts`**, one file per group (`traffic`, `orders`, `revenue`, `products`, `search`, `breakdowns`), each holding its daily rollups and its widget queries. `metrics/index.ts` exports `queryWidget(id, params)` and a registry typed so that a catalog id without a query, or a query returning the wrong `kind`, is a type error.

The rollup jobs loop over the rollups (`DAILY_ROLLUPS`); the API and dashboard loop over the catalog. The dashboard renders widgets by `kind`, so a new widget needs no dashboard code. Adding an analytic means: an event (if it needs a new one), a rollup and a query in the right group file, a catalog entry, and its translation key in all five locales (a unit test checks the keys).

**Access.** Revenue widgets (revenue, revenue over time, completed orders, average order value) have `access: 'superuser'`. Everything else has `access: 'staff'`. The API checks this per widget, so an admin requesting a superuser widget gets it left out of the response, and the dashboard hides widgets the viewer can't see.

## 7. Reading and the dashboard

- **API:** `GET /api/admin/analytics?widgets=traffic,top_products&from=…&to=…&granularity=day|week|month&limit=10&locale=ru`, behind `withAuth` + `isStaff` (401 anonymous, 403 FREE), plus the per-widget `access` check above. Every parameter is optional: all visible widgets, the last 30 days, `day`, 10 rows. Ranges over two years are rejected. It returns every widget in one response, which keeps client round-trips to one. A widget whose query fails comes back as `data: null` and the rest still load. Results are cached in memory for 60s, keyed by role tier and query. The response also carries the user count and the Telekom balance (3s timeout).
- **Page:** `/admin/analytics` replaces the old `/analytics` page (which now redirects there). It has range presets (7 days, 30 days, 90 days, 12 months, custom), a day/week/month toggle, and a grid of widgets rendered by `kind`: KPI cards with the change vs the previous period, line charts, the funnel with step conversion, and top lists with images and links.
- **Charts:** `@mui/x-charts` (matches MUI, bundled, no CDN), loaded with `next/dynamic` on admin pages only so it never ships to shoppers.

## 8. Starter metrics, in priority order

1. Visitors, sessions and page views over time, split by web and app.
2. Top N viewed products and top categories.
3. Top searches and **searches with zero results**. These are usually the most useful for a shop: they show what customers want and we don't stock.
4. Funnel: product view → add to cart → order placed → order completed, with conversion rates per step. The last step joins `order_placed` events to `UserOrder` by `orderId`.
5. Revenue (superuser only): completed-order revenue in TMT over time, number of completed orders, and average order value.
6. Breakdowns by locale and device, and the top referrer domains.

## Local development: seed data

`yarn seed:analytics-dev` fills the local database with about 120 days of realistic traffic (growth, weekly pattern, app/web and locale mix, searches including zero-result ones, a funnel, and seed orders linked to real products), builds the rollups, and prunes raw data older than 90 days, the same state production would be in. Options: `--days`, `--visitors-per-day`, `--seed`, `--no-orders`, `--clean`. Seed data is marked (visitor ids start with `5eed`, order numbers with `SEED-`) and `--clean` removes it. The script refuses to run unless `DATABASE_URL` points at a local database.

## Follow-ups

- Optional: TimescaleDB or Parquet archiving, and a CSV export.
- Mobile app: set a custom user-agent marker (see Collection).

## Decisions

- **Raw event retention:** 90 days.
- **Visitor ID:** first-party cookie `xa_vid`.
- **Access:** revenue metrics are superuser-only. All other metrics are visible to admins and superusers (`isStaff`).
- **Revenue:** completed orders only, read from `UserOrder`, in TMT, counted on the day the order was completed.

Related: stale `completedAt` after an order leaves `COMPLETED` is tracked in #505. It doesn't affect analytics, because the revenue rollup filters on `status` too.
