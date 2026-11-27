# Environment variables

Copy `.env.example` to `.env.local` for local dev. Below: purpose and whether they’re required for a minimal local run.

## Required for local

| Variable               | Description                   |
| ---------------------- | ----------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string  |
| `ACCESS_TOKEN_SECRET`  | Secret for JWT access tokens  |
| `REFRESH_TOKEN_SECRET` | Secret for JWT refresh tokens |

## Optional (app works without; features may be limited)

| Variable                                           | Description                                             |
| -------------------------------------------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_HOST`, `NEXT_PUBLIC_PORT`             | Host/port for canonical URLs                            |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_KEY`         | Google Search Console ownership verification (meta tag) |
| `NEXT_PUBLIC_WEBSOCKET_PORT`, `NEXT_PUBLIC_WS_URL` | WebSocket server (chat)                                 |
| `CATEGORY_IMAGES_DIR`, `PRODUCT_IMAGES_DIR`        | Paths for category/product images                       |
| `COMPRESSED_PRODUCT_IMAGES_DIR`                    | Compressed product images                               |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`                    | First-time admin creation (if used)                     |
| `TELEKOM_USERNAME`, `TELEKOM_PASSWORD`             | Telekom balance (batch-runner)                          |
| `SLACK_ORDER_BOT_WEBHOOK`                          | Slack order notifications                               |
| `SLACK_HEALTH_BOT_WEBHOOK`                         | Slack health/alert (batch-runner)                       |
| `TELEKOM_BALANCE_ALERT_THRESHOLD_TMT`              | Alert when balance below this (batch-runner)            |

## MCP server (AI apps)

| Variable                     | Description                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MCP_ENABLED`                | Kill switch. Unless exactly `true`, `/api/mcp`, its OAuth routes and the consent page all 404                                                           |
| `MCP_PUBLIC_ORIGIN`          | The site's public origin, e.g. `https://xmobile.com.tm`. Never taken from the Host header                                                               |
| `MCP_ALLOWED_REDIRECT_HOSTS` | Comma-separated hosts an AI app may redirect back to after login. Unset or blank: `chatgpt.com`, `claude.ai` and `oauth-redirect.googleusercontent.com` |
| `MCP_CLIENTS`                | The AI apps allowed to connect: a JSON array printed by `yarn mcp:create-client-*`. Empty: none can connect                                             |

See [mcp.md](mcp.md).

## Firebase / FCM

| Variable                         | Description                                     |
| -------------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_*`         | Web Firebase config (API key, project ID, etc.) |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web push (required for FCM tokens in browser)   |
| `FIREBASE_ADMIN_SDK_PATH`        | Path to service account JSON (server-side FCM)  |
| `FCM_FAILURE_THRESHOLD`          | Optional failure threshold                      |

See [fcm-setup.md](fcm-setup.md) for obtaining and setting these.
