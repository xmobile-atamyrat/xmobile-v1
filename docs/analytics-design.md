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
- Page views are recorded automatically: one for the initial load, one per `routeChangeComplete`, and one when the browser restores a page from its back/forward cache. They're deduped on locale + path (query-only and hash changes don't count; switching language does), and a reload that repeats the same view within 5 seconds isn't counted again. `path` has no locale prefix, query or hash. The first page view of a load carries the external `referrer` as a lowercase host name; every page view carries `device` (mobile / tablet / desktop). Strings are cut without splitting emoji.
- `product_view` and `category_view` are sent from the product and category pages (`useProductView`, `useCategoryView`).
- Staff-only routes (`/admin`, `/analytics`, `/server-logs`, `/procurement`, `/orders/admin`, the product and category admin tools) are never tracked.
- Product, category and other pages are served as ISR/static, so the server never sees most views. That's why a client-side beacon is required. Parsing nginx access logs would also miss client-side navigations, and filtering bots out of them is hard.
- It works unchanged inside the mobile WebView. The client tags events `platform=APP` only when `window.ReactNativeWebView` exists, so other apps' in-app browsers (Instagram, Telegram…) count as WEB. Server events detect the app from the user agent (Android `; wv)`, or iOS WebKit without `Safari/`), which can't tell our app from other WebViews. Recommended follow-up in `mobile/`: set `applicationNameForUserAgent="XMobileApp/<version>"` on the WebView; `detectPlatform` already recognises it.

**Server: `trackServer()`**

- Called directly in the API handlers for events that must be accurate: `order_placed`, `cart_add`, `search` (with result count), `chat_started`, `signup`. These can't be blocked by ad blockers and can't be faked. `trackServer()` is fire-and-forget: it never throws and never waits on the database.
- `cart_add` means a new line in the cart (logged-in or guest), not a quantity change.
- `search` is recorded for page 1 of a storefront product search. The home page searches as you type, so each visitor's search intent is held for 3s and replaced by their next one (by arrival order): only the term they stopped on counts, and only that term's result count is queried. `results` counts matches for the keyword alone, ignoring category, brand, price and stock filters, so "searches with zero results" means "we don't stock it". The same visitor repeating the same term within 30 minutes (a sort or filter change) isn't counted again. Queries are trimmed, lower-cased and capped at 100 characters. Searches rendered on the server (`/?q=` on first load) aren't tracked.
- Server events take their locale from the same-origin `Referer` path (no prefix means `ru`), then the `NEXT_LOCALE` cookie, so they agree with the page the visitor was on.
- `order_placed` is sent for logged-in and guest checkout, `chat_started` when a new chat session is created, `signup` when an account is created.

**Staff are excluded.** No events are recorded for ADMIN or SUPERUSER users, so staff browsing the shop doesn't skew the numbers. `/api/events` and `trackServer()` look up the user's current role (cached for 5 minutes, so a role change takes up to 5 minutes to apply) and drop staff events. Events from a soft-deleted account are recorded without a `userId`.

**Orders and revenue**

- Revenue only counts completed orders, and it's attributed to the day the order was completed.
- Revenue, completed-order counts and average order value are **not** summed from events. The rollup reads `UserOrder` directly (`status = 'COMPLETED'`, grouped by the Ashgabat day of `completedAt`). The order table is the source of truth, and an event can't be taken back. Admins can change a total after the order is placed (the delivery fee), and an order can be moved out of `COMPLETED` again. Reading the table also lets us backfill revenue for orders from before tracking existed.
- `totalPrice` is a string holding a TMT amount, so revenue is reported in TMT. The rollup parses it the same way `orderService` does.
- Only one order event is tracked: `order_placed`, carrying just the `orderId`. `UserOrder` doesn't know the analytics visitor or session, so without this event the funnel couldn't connect "viewed product → added to cart" to the order that followed. Whether that order was completed is looked up in `UserOrder` by `orderId` at rollup time, so there's no `order_completed` event, and no totals in the payload that could go stale.

**Identity**

- Visitor: a random first-party cookie `xa_vid` (1 year). This is more accurate than a cookieless hashed-IP ID, which breaks when many users share one carrier NAT IP (common on mobile networks here) and resets every day. Session: 30 minutes of inactivity. Add `userId` when the user is logged in.
- Both cookies are set by the client (`Path=/; SameSite=Lax`, `Secure` on https) and read by the server. Events without a valid `xa_vid` are dropped. `/api/events` re-issues the visitor's existing `xa_vid` with `Set-Cookie`, because Safari and iOS WebViews expire cookies written by JavaScript after 7 days; the server never mints an id.
- When an account is permanently deleted, its events keep their data but their `userId` is cleared in the same transaction.
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

`productId` and `categoryId` must be UUIDs and `referrer` a host name, because these values become rollup rows that are kept forever; an event with a bad id is dropped, a bad referrer is just left out. `CLIENT_EVENT_NAMES` lists the events the browser may send; the rest are server-only and `/api/events` drops them. `entityKey` says which prop goes into the `entityId` column. The schemas give type safety on the client and validation on the server. Adding a new event is one entry here.

## 3. Ingestion: `POST /api/events`

- Why not `/api/analytics` or `/api/track`: ad-blocker filter lists (EasyPrivacy, uBlock) ship generic rules that match paths containing `analytics`, `track`, `collect`, `beacon` and similar, even on first-party domains. `/api/events` is still self-explanatory and doesn't hit those rules. (The admin read API, `/api/admin/analytics`, isn't affected because it isn't loaded by shoppers.)
- Body: `{ platform: 'WEB' | 'APP', locale, sentAt, events: [{ name, props, ts }] }`. Identity comes only from the cookies, and `userId` from the refresh-token cookie (beacons carry no `Authorization` header).
- Validate against the catalog and drop invalid or server-only events one by one. Drop bots using a user-agent regex (search crawlers hit the ISR pages a lot). Every string is cleaned of NUL characters and broken UTF-16 (Postgres rejects both).
- **Timestamps.** Phone clocks are often wrong, and client events must line up with server events (the funnel compares them). The server stores `ts + (serverNow − sentAt)`, which removes the device's clock offset, clamped to the last hour (plus the 30s the client may hold an event) and never in the future.
- Responses: 204 on success, and also when the batch is dropped on purpose (bot, no visitor cookie, staff); 400 for a malformed body or more than 50 events; 429 when rate-limited; 405 for other methods. Body limit 64 KB.
- **Rate limits.** 60 requests/min per visitor and IP, plus 300 events/min and 50,000 events/day per IP (counting events, not requests, so rotating `xa_vid` doesn't help). The client IP comes from `X-Real-IP`, so nginx must keep `proxy_set_header X-Real-IP $remote_addr` on every location that proxies to Next, and Next must only be reachable through nginx.
- Push events into a process-local buffer. Flush every 5s or every 500 events with one multi-row `INSERT` (`createMany`). This keeps the cost to Postgres at almost nothing. The buffer holds at most 5000 rows; past that, new events are dropped with one warning, so a database outage can't grow memory. If an insert fails, the batch is split in halves down to single rows, so one bad row can't take everyone's events with it.
- Trade-off: a crash loses up to 5s of events. That's fine for analytics. If durability is ever needed, append to an NDJSON file and have the batch runner load it, but don't start there.

## 4. Storage

Both tables are ordinary Prisma models in `prisma/schema.prisma`, so they go through `prisma migrate` like everything else. No raw-SQL tables and no partitioning (see "Why no partitions" below).

```prisma
enum AnalyticsPlatform {
  WEB
  APP
}

model AnalyticsEvent {
  id          BigInt            @id @default(autoincrement())
  occurredAt  DateTime          @default(now())
  // An EventName from src/lib/analytics/events.ts
  name        String
  // From the xa_vid / xa_sid cookies
  visitorId   String
  sessionId   String?
  userId      String?
  // Product, category or order id, depending on the event
  entityId    String?
  platform    AnalyticsPlatform
  locale      String
  props       Json?

  @@index([occurredAt])
  @@index([name, occurredAt])
}

// Daily rollups of AnalyticsEvent and UserOrder, kept forever.
model AnalyticsDaily {
  // Midnight of an Asia/Ashgabat calendar day (not UTC). Week and month rows
  // use the first day of the period.
  day             DateTime
  metric          String
  // Both '' for the total row
  dimension       String   @default("")
  dimensionValue  String   @default("")
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

`revenue_tmt` is stored in hundredths of a manat (the example is 84 500 TMT), because `value` is an integer. `revenue_tmt` and `orders_completed` rows exist only for days with a completed order (no row means 0). `visitors_week` and `visitors_month` rows are only written once their period is over, so a stored row is always final.

The full list of stored metrics and their dimensions is in the header of `src/lib/analytics/rollup.ts`. Stored metric names aren't widget ids: one stored series can feed several widgets.

**Enum or text.** The rule we follow: a small, closed set that rarely changes is a Postgres enum (`platform`). A set that grows every time we add a feature is text, constrained in TypeScript instead (`name` is typed as `EventName`, `metric` as `MetricId`, both derived from the code registries). Making `name` or `metric` an enum would turn every new event or metric into a migration, and Postgres can't remove an enum value once it's added. `locale` stays a short string because the values read clearly and the list is owned by the i18n config.

**Size estimates.** Measured on seeded data, a raw row takes about 400–600 bytes on disk including its indexes (the tuple itself is ~155 bytes).

| Scale                                | Raw data per day | Raw data for 90 days |
| ------------------------------------ | ---------------- | -------------------- |
| 20k events/day (today)               | ~10 MB           | ~1 GB                |
| 300k events/day (100k monthly users) | ~150 MB          | ~13 GB               |

At the upper end that's a real share of the 58 GB disk; partitioning or a shorter window would be the lever then (see below).

Rollups stay in the megabytes for years.

**Retention.** Raw events are kept for 90 days. A nightly `analytics-retention` job deletes older rows in batches, the same way `admin-activity-retention` already does. At today's volume that's ~20k rows a night, which autovacuum handles without trouble.

**Why no partitions.** Partitioning would make deletes free (drop a whole month), but it costs more than it saves at this scale:

- Prisma can't declare partitioned tables, so the table would have to live outside `schema.prisma`. The next `prisma migrate dev` would then see a table it doesn't know about and generate a `DROP TABLE` for it. The monthly partitions the batch runner creates would also show up as drift in local databases and trigger reset prompts.
- The workaround (putting the tables in a separate Postgres schema that Prisma ignores, and querying them with `$queryRaw`) works, but it means hand-written SQL and no generated types.

Revisit this if raw volume heads towards a few hundred thousand events a day and the nightly delete gets slow. Moving to a partitioned table then is a one-off migration.

**If more compression is needed later:**

- **TimescaleDB** columnar compression gives 10–20x on raw data. Whether that's possible depends on installing the extension offline on the VM.
- **Archive old rows to Parquet** with DuckDB (zstd, about 10x) before deleting them, if raw history is wanted for ad-hoc analysis.

**Unique visitors.** These can't be summed: daily uniques don't add up to monthly uniques. They're stored as separate metrics (`visitors`, `visitors_week`, `visitors_month`, with `day` = the start of the period). The dashboard counts the part of a range inside the 90-day raw window exactly with `COUNT(DISTINCT)` on raw events, and adds the tightest upper bound for any older part (per week and month, the smaller of the stored row and the summed daily uniques). Sessions and the platform breakdown work the same way. The traffic chart sums daily sessions, so a session that crosses midnight counts on both days there. At this scale an exact `COUNT(DISTINCT)` is fine, so HyperLogLog isn't needed.

## 5. Rollup jobs (batch runner)

Three jobs, registered in `scripts/batch-runner/jobs/registry.ts`:

- `analytics-rollup`: every 10 minutes, recompute **today**, plus yesterday during the first hour after Ashgabat midnight so late events land. Its first run after start-up also fills in any missing week/month rows.
- `analytics-rollup-nightly`: 01:30 Asia/Ashgabat. Re-rolls every metric for the last 7 days (so a missed run or a downtime heals itself), counts the weekly and monthly uniques for every period touching them, recomputes revenue and completed orders for **all** days in one grouped query (so old orders' status changes and edits show up, and history fills in after the first deploy), and refreshes the funnel for the rest of the raw window.
- `analytics-retention`: 04:30 Asia/Ashgabat. Deletes raw events older than 90 days, in batches. Same pattern as `admin-activity-retention`.

Each rollup replaces one day's rows for its metrics with `INSERT … SELECT` statements in a single transaction, under an advisory lock, so reruns and overlapping runs are safe. Days older than the raw window only get their order-based metrics recomputed, so pruned days aren't overwritten with zeros.

## 6. Metric registry (extension point #2)

Two pieces:

- **`src/lib/analytics/metrics/catalog.ts`** lists every dashboard widget in display order: `{ id, kind, access, unit, labelKey }`, where `kind` is `kpi | timeseries | topN | funnel` and `unit` is `count | tmt | percent` (percent values are 0–100).
- **`src/lib/analytics/metrics/*.ts`**, one file per group (`traffic`, `orders`, `revenue`, `products`, `search`, `breakdowns`), each holding its daily rollups and its widget queries. `metrics/index.ts` exports `queryWidget(id, params)` and a registry typed so that a catalog id without a query, or a query returning the wrong `kind`, is a type error.

The rollup jobs loop over the rollups (`DAILY_ROLLUPS`); the API and dashboard loop over the catalog. The dashboard renders widgets by `kind`, so a new widget needs no dashboard code. Adding an analytic means: an event (if it needs a new one), a rollup and a query in the right group file, a catalog entry, and its translation key in all five locales (a unit test checks the keys).

**Access.** Revenue widgets (revenue, revenue over time, completed orders, average order value) have `access: 'superuser'`. Everything else has `access: 'staff'`. The API checks this per widget, so an admin requesting a superuser widget gets it left out of the response, and the dashboard hides widgets the viewer can't see.

## 7. Reading and the dashboard

- **API:** `GET /api/admin/analytics?widgets=traffic,top_products&from=…&to=…&granularity=day|week|month&limit=10&locale=ru`, behind `withAuth` + `isStaff` (401 anonymous, 403 FREE), plus the per-widget `access` check above. Every parameter is optional: all visible widgets, the last 30 days, `day`, 10 rows. Ranges over two years, days before 2020-01-01 and days after tomorrow (Ashgabat) are rejected with 400. It returns every widget in one response, which keeps client round-trips to one. A widget whose query fails comes back as `data: null` and the rest still load. Results are cached in memory for 60s, keyed by role tier and query. The response also carries the user count and the Telekom balance (3s timeout).
- **"vs previous period".** Each KPI is compared with the equally long range just before it. When the range ends today, both ranges are cut at the same time of day (the previous range's last day counts up to `now − N days`, from raw events or `UserOrder` timestamps), so a half-finished today isn't compared with a full day. If one side is exact and the other only an upper bound, no change is shown. KPIs for ranges ending today are therefore live, and can be up to 10 minutes ahead of the charts, which read the rollups.
- **Page:** `/admin/analytics` replaces the old `/analytics` page (which now redirects there). It has range presets (7 days, 30 days, 90 days, 12 months, custom), a day/week/month toggle, and a grid of widgets rendered by `kind`: KPI cards with the change vs the previous period, line charts, the funnel with step conversion, and top lists with images and links.
  - Week and month views start on a whole period (the Monday or the 1st), so the first point isn't a partial period; the KPIs cover the same range, and the label shows it. A note under each chart says when the last point includes today.
  - "Today" follows the Ashgabat clock even if the page stays open past midnight.
  - The browser cache key includes the user and role, and signing out or deleting the account clears it, so a superuser's revenue can't be shown to the next person on a shared device.
  - Each chart has a screen-reader summary; failed widgets are announced once.
- **Charts:** `@mui/x-charts` (matches MUI, bundled, no CDN), loaded with `next/dynamic` on admin pages only so it never ships to shoppers.

## 8. Starter metrics, in priority order

1. Visitors, sessions and page views over time, split by web and app.
2. Top N viewed products and top categories.
3. Top searches and **searches with zero results**. These are usually the most useful for a shop: they show what customers want and we don't stock.
4. Funnel: product view → add to cart → order placed → order completed, with conversion rates per step. Every step counts visitors, each step requires the previous one by the same visitor in the range (with 2 minutes of slack for clock differences), and the last step joins `order_placed` events to `UserOrder` by `orderId`. The completed step is a count, not money, so admins see it too.
5. Revenue (superuser only): completed-order revenue in TMT over time, number of completed orders, and average order value.
6. Breakdowns by locale and device, and the top referrer domains.

## Local development: seed data

`yarn seed:analytics-dev` fills the local database with about 120 days of realistic traffic (growth, weekly pattern, app/web and locale mix, searches including zero-result ones, a funnel, and seed orders linked to real products), builds the rollups, and prunes raw data older than 90 days, the same state production would be in. Options: `--days`, `--visitors-per-day`, `--seed`, `--no-orders`, `--clean`, `--force`.

- Seed data is marked: visitor ids start with `5eed`, order numbers with `SEED-`, and the seeded day range is recorded in an `AnalyticsDaily` row with metric `seed_marker`. Re-seeding and `--clean` rebuild only those days.
- Safety: the script refuses when `NEXT_PUBLIC_APP_ENV` is production or staging, when `DATABASE_URL` isn't a local host, when real event rollups older than the raw window would be rebuilt, or when the database holds more than 50 real raw events older than a day. `--force` overrides, listing each reason. On the production VM the database is also `localhost`, so the history checks are what actually protect it.

## Follow-ups

- Optional: TimescaleDB or Parquet archiving, and a CSV export.
- Mobile app: set a custom user-agent marker (see Collection).

## Decisions

- **Raw event retention:** 90 days.
- **Visitor ID:** first-party cookie `xa_vid`.
- **Access:** revenue metrics are superuser-only. All other metrics are visible to admins and superusers (`isStaff`).
- **Revenue:** completed orders only, read from `UserOrder`, in TMT, counted on the day the order was completed.

Related: stale `completedAt` after an order leaves `COMPLETED` is tracked in #505. It doesn't affect analytics, because the revenue rollup filters on `status` too.
