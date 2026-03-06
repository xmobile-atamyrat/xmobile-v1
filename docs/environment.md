# Environment variables

Copy `.env.example` to `.env.local` for local dev. Below: purpose and whether they’re required for a minimal local run.

## Required for local

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `ACCESS_TOKEN_SECRET` | Secret for JWT access tokens |
| `REFRESH_TOKEN_SECRET` | Secret for JWT refresh tokens |

## Optional (app works without; features may be limited)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_HOST`, `NEXT_PUBLIC_PORT` | Host/port for canonical URLs |
| `NEXT_PUBLIC_WEBSOCKET_PORT`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_WS_MAX_RECONNECT_ATTEMPTS` | WebSocket server (chat) |
| `CATEGORY_IMAGES_DIR`, `PRODUCT_IMAGES_DIR` | Paths for category/product images |
| `COMPRESSED_PRODUCT_IMAGES_DIR` | Compressed product images |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First-time admin creation (if used) |
| `TELEKOM_USERNAME`, `TELEKOM_PASSWORD` | Telekom balance (batch-runner) |
| `SLACK_ORDER_BOT_WEBHOOK` | Slack order notifications |
| `SLACK_HEALTH_BOT_WEBHOOK` | Slack health/alert (batch-runner) |
| `TELEKOM_BALANCE_ALERT_THRESHOLD_TMT` | Alert when balance below this (batch-runner) |

## Firebase / FCM

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_*` | Web Firebase config (API key, project ID, etc.) |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web push (required for FCM tokens in browser) |
| `FIREBASE_ADMIN_SDK_PATH` | Path to service account JSON (server-side FCM) |
| `FCM_FAILURE_THRESHOLD` | Optional failure threshold |

See [FCM_SETUP.md](FCM_SETUP.md) for obtaining and setting these.
