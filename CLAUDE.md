# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read `AGENTS.md` too: it covers the production constraints (a single 4-CPU / 4 GB VM in Turkmenistan, poor connectivity, most of the outside internet blocked). The practical upshot: no new external SaaS, CDNs, Google Fonts or analytics hosts, and keep client round-trips to a minimum. More docs live in `docs/` (architecture, api, database, deployment, environment, features, seo-knowledge).

## Commands

Setup: `cp .env.example .env.local`, then set `DATABASE_URL`, `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`. The `*-dev` scripts check that `.env.local` exists and fail without it.

- `yarn dev`: Next.js on http://localhost:3003
- `yarn dev:ws`: WebSocket chat server. It runs as a separate process, so start it in a second terminal.
- `yarn db:generate-dev` / `yarn db:migrate-dev` / `yarn db:studio-dev`: Prisma commands against `.env.local`. The `*-prod` variants use `.env`, so don't run them locally.
- `yarn build:batch-runner && yarn start:batch-runner`: builds and starts the cron/interval job process

### Verification (run before calling a task done, per `.cursor/rules/verify-after-edits.mdc`)

```bash
npx eslint --fix .          # the same command pre-commit runs
yarn tsc --noEmit
npx prettier --write --ignore-unknown <changed files>
```

If you touched `mobile/`, also run `cd mobile && npx tsc --noEmit && yarn lint`.

### Tests (Vitest + Playwright)

- `yarn test:unit`: `tests/unit/**`, node env, TZ=UTC
- `yarn test:client`: `tests/client/**/*.test.ts`, React component tests
- `yarn test:integration`: `tests/integration/**`. **Requires Docker.** Testcontainers starts Postgres and runs `prisma migrate deploy`. Test files run serially.
- `yarn test`: unit + client, then integration
- `yarn test:e2e`: Playwright in `tests/e2e/`. Requires Docker. `tests/e2e/global-setup.ts` boots Postgres, seeds it, then starts Next. Don't add a Playwright `webServer`. Default locale is `ru`, timezone `Asia/Ashgabat`.
- Single file: `npx vitest run --project unit tests/unit/foo.test.ts`, or `npx vitest run --config vitest.integration.config.ts tests/integration/cart.integration.test.ts`. Filter by test name with `-t "name"`.

## Architecture

Four processes share one PostgreSQL database (`DATABASE_URL`):

1. **Next.js 14 app (Pages Router)**: the web UI plus the REST API.
2. **WebSocket server** (`src/ws-server/`): real-time chat between users and admins. It is built separately with `tsconfig.ws.json`. Push notifications go through FCM (`src/lib/fcm`).
3. **Batch runner** (`scripts/batch-runner/`): jobs such as healthcheck, telekom-balance, out-of-stock sync/cleanup, notification retry and account deletion. To add a job, create a `BatchJob` in `jobs/` and register it in `jobs/registry.ts`.
4. **Mobile app** (`mobile/`): React Native app that **wraps the web app in a WebView**. It has its own `package.json`. Most UI changes therefore land in the web app.

### Conventions that aren't obvious

- **Page extensions**: `next.config.mjs` sets `pageExtensions: ['page.tsx', 'page.ts']`. Only `*.page.ts(x)` files under `src/pages/` become routes or API endpoints. Helpers, components and hooks inside `src/pages/` (e.g. `src/pages/lib`, `src/pages/components`, `src/pages/api/utils`) must **not** use that suffix.
- **Imports**: `@/` maps to `src/`.
- **API routes** (`src/pages/api/**`) are plain handlers that branch on `req.method`. They call `addCors(res)` and return `ResponseApi` (`{ success, message, data? }` from `src/pages/lib/types`). Larger domains split into `controllers/` (return `{ resp, status }`), `services/` and `validators/` (Zod). `api/order/` is the reference example.
- **Auth**: JWT access token in `Authorization: Bearer`, plus a refresh token in a cookie. Wrap handlers with `withAuth` (`api/utils/authMiddleware.ts`), which sets `req.userId` and `req.grade`. It also silently refreshes an expired access token, and it has a GET bypass list for public endpoints. For role checks, use `api/utils/staffAuth.ts` (`isStaff` = ADMIN|SUPERUSER, `isSuperuser`). Roles are `UserRole` FREE/ADMIN/SUPERUSER. Guest checkout goes through `api/utils/guestSession.ts`.
- **Prisma**: use the singleton in `src/lib/dbClient.ts`. Products, categories and banners are soft-deleted (`deletedAt`), so storefront queries must include `whereActiveProduct` / `whereActiveCategory` / `whereActiveBanner` from `src/lib/prismaActiveScope.ts`.
- **ISR**: `/product/[slug]`, `/category/[slug]` and `/product-category/[categorySlug]` are statically generated. After a catalog mutation, trigger on-demand revalidation via `src/lib/revalidate.ts` / `revalidateTargets.ts`. Batches are capped at 250 paths, and larger batches are dropped rather than truncated.
- **i18n**: next-intl with Next's built-in locale routing. Locales are `ru` (default), `en`, `tk`, `tr`, `ch`, and messages live in `src/i18n/<locale>.json`. A new key must go into all five files. The helpers `scripts/translations/add-translation-row.mjs <key> <value>` and `remove-translation-row.mjs <key>` do this.
- **Media**: uploaded images live on the VM disk and production nginx serves them at `/media`. In local dev without the nginx container (`yarn docker:media-up`), `/media/*` is rewritten to the `/api/media` fallback route.
- **Prices**: amounts are stored in USD and TMT (`CURRENCY` enum), and the dollar rate comes from `src/lib/dollarRateService.ts`. Stock and out-of-stock logic lives in `src/lib/outOfStock.ts` and `src/lib/variantStock.ts`.
- **Logging/alerts**: `src/lib/logger.ts` forwards errors to Slack (throttled by `alertThrottle.ts`). Slack is best-effort, so never make a core flow depend on it.
- **Style**: ESLint uses airbnb-base + TypeScript + Prettier. Prettier uses single quotes.
