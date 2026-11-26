# Analytics framework: proposed design

Status: proposal. Nothing here is implemented yet.

## What's there today

- The old `UserVisitRecord` table had no writer after IP tracking was removed (`db85cddc`, 2026-03-28), so its visit counts were frozen. It was dropped in migration `20261126000000_drop_user_visit_record`, and the visit counts were removed from `src/pages/analytics/index.page.tsx`. That page now shows only the user count and Telekom balance, and the new dashboard should replace it.
- There's no chart library. `src/pages/admin/activity/ActivityHeatmap.tsx` is hand-drawn SVG on MUI.
- Three existing pieces are worth reusing: the batch runner (with a retention-job pattern in `scripts/batch-runner/jobs/admin-activity-retention.ts`), the `isStaff` role check (`src/pages/api/utils/staffAuth.ts`), and SWR.

## Scale and storage: aggregate early, keep raw data briefly

At ~3k monthly users we'll see roughly 10–30k events a day. Even at 100k monthly users it's maybe 300–500k a day. Postgres on this VM (4 CPU / 4 GB RAM / 58 GB disk) handles that comfortably, so this isn't a "massive data" problem yet. The real saving is to **aggregate early and keep raw events only for a short time**. A daily rollup row replaces thousands of raw rows and can be kept forever. Compression codecs matter much less than that.

That's also why we skip ClickHouse, Plausible (which runs on ClickHouse) and Matomo. ClickHouse alone wants most of the 4 GB of RAM. Umami runs on Postgres and would be workable, but it doesn't know about our products, roles or orders, and it adds another process to run. The recommendation is to build it in-house on the existing Postgres.

## How it fits together

```
Browser / WebView ──sendBeacon (batched)──▶ POST /api/t ─┐
API handlers (orders, cart, search) ──trackServer()─────┤
                                                       ▼
                                      in-memory buffer → multi-row INSERT every ~5s
                                                       ▼
                         analytics_event (raw, monthly partitions, 90–180 day retention)
                                                       ▼   batch runner: rollup every 10 min + nightly
                         analytics_daily (small rollup table, kept forever)
                                                       ▼
          GET /api/admin/analytics?widgets=…  (isStaff, one request for the whole dashboard)
                                                       ▼
                         /admin/analytics dashboard (widgets from a registry)
```

## 1. Collection

**Client: `src/lib/analytics/client.ts`**

- Typed calls such as `track('product_view', { productId })`. Events queue in memory and are sent in a single `navigator.sendBeacon` call on `visibilitychange`/`pagehide`, every 30s, or after 20 events. That's about one request per session chunk, which suits slow connections. No third-party script is involved.
- Page views are recorded automatically from Next's `router.events` `routeChangeComplete`.
- Product, category and other pages are served as ISR/static, so the server never sees most views. That's why a client-side beacon is required. Parsing nginx access logs would also miss client-side navigations, and filtering bots out of them is hard.
- It works unchanged inside the mobile WebView. Tag those events `platform=app` (via the user agent or an injected flag).

**Server: `trackServer()`**

- Called directly in the API handlers for events that must be accurate: `order_placed`, `cart_add`, `search` (with result count), `chat_started`, `signup`. These can't be blocked by ad blockers and can't be faked.

**Identity**

- Visitor: a random first-party cookie `xa_vid` (1 year). Session: 30 minutes of inactivity. Add `userId` when the user is logged in.
- Don't store raw IPs. Store a hash of IP plus user agent with a daily salt, only for deduplication.

## 2. Event catalog (extension point #1)

`src/lib/analytics/events.ts` holds one Zod schema per event name:

```ts
export const events = {
  page_view: z.object({ path: z.string().max(300) }),
  product_view: z.object({ productId: z.string() }),
  search: z.object({ q: z.string().max(100), results: z.number() }),
  cart_add: z.object({ productId: z.string(), qty: z.number() }),
  order_placed: z.object({ orderId: z.string(), totalUsd: z.number() }),
} as const;
```

The schemas give type safety on the client and validation on the server. Adding a new event is one line here.

## 3. Ingestion: `POST /api/t`

- Validate against the catalog, drop bots using a user-agent regex (search crawlers hit the ISR pages a lot), cap each batch at 50 events, and rate-limit per visitor.
- Push events into a process-local buffer. Flush every 5s or every 500 events with one multi-row `INSERT`. This keeps the cost to Postgres at almost nothing.
- Trade-off: a crash loses up to 5s of events. That's fine for analytics. If durability is ever needed, append to an NDJSON file and have the batch runner load it, but don't start there.

## 4. Storage

Create the tables with raw SQL in a migration and query them with `$queryRaw`. Prisma doesn't manage partitions.

```sql
-- Raw events: narrow rows, monthly partitions
CREATE TABLE analytics_event (
  ts          timestamptz NOT NULL,
  name        text        NOT NULL,   -- or smallint code
  visitor_id  uuid        NOT NULL,
  session_id  uuid,
  user_id     text,
  entity_id   text,                   -- productId/categoryId: what top-N queries group on
  platform    smallint,               -- 0 web, 1 app
  locale      char(2),
  props       jsonb                   -- everything else
) PARTITION BY RANGE (ts);
-- a BRIN index on ts (tiny) + (name, ts)

-- Rollups: one generic long table, kept forever
CREATE TABLE analytics_daily (
  day     date   NOT NULL,             -- Asia/Ashgabat day, not UTC
  metric  text   NOT NULL,             -- 'pageviews', 'visitors', 'product_view', …
  dim     text   NOT NULL DEFAULT '',  -- '' = total, or a productId / locale / platform
  value   bigint NOT NULL,
  PRIMARY KEY (metric, day, dim)
);
```

**Size estimates.** A raw row with indexes is about 150 bytes.

| Scale                                | Raw data per day | Raw data for 90 days |
| ------------------------------------ | ---------------- | -------------------- |
| 20k events/day (today)               | ~3 MB            | ~300 MB              |
| 300k events/day (100k monthly users) | ~45 MB           | ~4 GB                |

Rollups stay in the megabytes for years.

**Retention.** Drop whole partitions once they're past retention. Dropping a partition is instant and leaves no vacuum bloat, unlike `DELETE`.

**If more compression is needed later:**

- **TimescaleDB** columnar compression gives 10–20x on raw data. Whether that's possible depends on installing the extension offline on the VM.
- **Archive old partitions to Parquet** with DuckDB (zstd, about 10x) before dropping them, if raw history is wanted for ad-hoc analysis.

**Unique visitors.** These can't be summed: daily uniques don't add up to monthly uniques. Store daily, weekly and monthly unique counts as separate rollups, or compute them from raw data inside the retention window. At this scale an exact `COUNT(DISTINCT)` is fine, so HyperLogLog isn't needed.

## 5. Rollup jobs (batch runner)

Three jobs, registered in `scripts/batch-runner/jobs/registry.ts`:

- `analytics-rollup`: every 10 minutes, recompute **today** and upsert it. The job is idempotent, so reruns are safe.
- Nightly: finalize yesterday, plus the weekly and monthly uniques.
- `analytics-partitions`: create next month's partition ahead of time and drop expired ones. Same pattern as `admin-activity-retention`.

## 6. Metric registry (extension point #2)

Each metric is one file in `src/lib/analytics/metrics/`:

```ts
export const topProducts: MetricDef = {
  id: 'top_products',
  kind: 'topN', // 'timeseries' | 'topN' | 'kpi' | 'funnel'
  rollup: sql`INSERT INTO analytics_daily … SELECT day, 'product_view', entity_id, count(*) … GROUP BY 1,3`,
  query: ({ from, to, limit }) => /* SELECT dim, sum(value) … ORDER BY 2 DESC LIMIT $limit */,
  enrich: async (rows) => /* join product names/images from Prisma */,
  labelKey: 'analytics.topProducts', // translation key, must exist in all 5 locales
};
```

The rollup job loops over the registry and runs each metric's `rollup`. The API and dashboard loop over it too. Adding an analytic means one event (if it needs a new one), one metric file and one translation key.

## 7. Reading and the dashboard

- **API:** `GET /api/admin/analytics?widgets=visits,top_products&from=…&to=…&granularity=day|week|month`, behind `withAuth` + `isStaff`. It returns every widget in one response, which keeps client round-trips to one. Cache results in memory for about 60s.
- **Page:** `/admin/analytics` replaces the old `/analytics` page. It has a date-range picker and a grid of widgets rendered by `kind`.
- **Charts:** `@mui/x-charts` (matches MUI, bundled, no CDN), loaded with `next/dynamic` on admin pages only so it never ships to shoppers. The lighter option is uPlot (~45 KB).

## 8. Starter metrics, in priority order

1. Visitors, sessions and page views over time, split by web and app.
2. Top N viewed products and top categories.
3. Top searches and **searches with zero results**. These are usually the most useful for a shop: they show what customers want and we don't stock.
4. Funnel: product view → add to cart → order, with conversion rates per step.
5. Breakdowns by locale and device, and the top referrer domains.

## Rollout

1. Tables, partitions, `/api/t`, the client tracker and auto page views.
2. Rollup jobs, the registry, the admin API, and the visits chart plus top products. Retire the old `/analytics` page.
3. Server events (orders, cart, search), the funnel and the zero-result searches widget.
4. Optional: TimescaleDB or Parquet archiving, and a CSV export.

## Open decisions

- **Retention for raw events:** 90 or 180 days.
- **Cookie-based or cookieless visitor IDs:** a cookie is more accurate, while the hashed-IP approach needs no cookie at all.
- **Who sees it:** admins (`isStaff`) or superusers only. Revenue metrics may be superuser-only.
