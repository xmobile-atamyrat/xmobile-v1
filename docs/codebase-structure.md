# Codebase structure

Where to find things.

## Root

| Path | Purpose |
|------|--------|
| `src/` | Next.js app + WebSocket server |
| `prisma/` | Schema and migrations |
| `scripts/` | Batch-runner, image scripts, prod helpers |
| `mobile/` | React Native app (separate build) |
| `public/` | Static assets |

## `src/`

| Path | Purpose |
|------|--------|
| `pages/` | Next.js pages (`.page.tsx`) and API routes (`api/**/*.page.ts`) |
| `lib/` | Shared server libs: DB client, FCM, Slack, logger |
| `ws-server/` | WebSocket server entry and chat/FCM logic |
| `styles/` | Theme, globals, MUI class maps |
| `i18n/` | Locale JSON (ru, tr, ch, etc.) |

## `src/pages/`

- **Routes:** `index`, `product/`, `category/`, `cart/`, `orders/`, `user/`, `chat/`, `procurement/`, `orders/admin/`, etc.
- **API:** `api/` mirrors URL structure (e.g. `api/order/index.page.ts` → `POST /api/order`).
- **Shared:** `lib/` (hooks, contexts, API helpers), `components/` (Layout, ProductCard, chat, etc.).

## `prisma/`

- `schema.prisma` — single source of truth for models.
- `migrations/` — versioned SQL migrations. Apply with `yarn db:migrate-dev`.

## `scripts/`

- `batch-runner/` — cron/interval jobs; entry `batch-runner.ts`, jobs in `jobs/`, registry in `jobs/registry.ts`.
- `prod_scripts/`, `backup-*`, `apply-backup.sh` — deployment and backup.

## `mobile/`

React Native app; own `package.json` and build (iOS/Android). Talks to same backend (env for API/WS URLs).
