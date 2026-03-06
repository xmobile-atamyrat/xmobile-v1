# Architecture

High-level view of how the project fits together.

## Components

| Component | Role | Runs as |
|-----------|------|--------|
| **Next.js app** | Web UI + REST API | `yarn dev` (port 3003) |
| **WebSocket server** | Real-time chat | Separate process: `yarn dev:ws` |
| **Batch runner** | Cron/interval jobs (healthcheck, telekom balance) | Separate process: `yarn start:batch-runner` |
| **Mobile app** | React Native (iOS/Android) | Built from `mobile/`; consumes same API + WS |

## Data flow

- **Database:** PostgreSQL. Shared by the Next.js app, WS server, and batch-runner (all use `DATABASE_URL`).
- **API:** REST under `/api/*` (Next.js API routes). Auth via JWT (Bearer + refresh cookie).
- **Realtime:** Clients connect to the WS server (`NEXT_PUBLIC_WS_URL`). Chat and notifications use WS + FCM.
- **Mobile:** Uses same REST + WS; app version checks via `/api/app-version`.

## Stack

- **Web:** Next.js 14, React, MUI, next-intl (i18n).
- **API:** next-connect, Prisma, JWT, Zod.
- **Realtime:** `ws` (WebSocket), Firebase (FCM for push).
- **Jobs:** Custom runner in `scripts/batch-runner` (node-cron–style schedules).
