# Features

Short reference to major features and where they live.

## Auth

- **Sign up / sign in:** `api/user/signup`, `api/user/signin`; pages under `user/` (signin, signup, profile).
- **Session:** JWT access + refresh token (cookie). `withAuth` in API; `UserContext` on the client.
- **Roles:** `UserRole` in Prisma (e.g. FREE, ADMIN); admin routes check `grade`.

## Cart & checkout

- **Cart:** `api/cart` (CRUD); cart state/UI in `pages/cart/`, `components/AddToCart`.
- **Checkout:** `pages/cart/checkout/` (flow + success). Orders created via `api/order`.

## Orders

- **Customer:** List/detail in `pages/orders/`; create via API from checkout.
- **Admin:** `pages/orders/admin/`, `api/order/admin` — list, update status/notes.

## Procurement

- **Suppliers/products:** `api/procurement/supplier`, `api/procurement/product`; UI in `pages/procurement/`.
- **Orders:** `api/procurement/order/*` (prices, quantities, etc.); procurement orders and history in schema.

## Chat

- **REST:** Sessions and messages in `api/chat/*`.
- **Realtime:** WebSocket server `src/ws-server/`; client in `WebSocketContext`, `ChatContext`; UI in `components/chat/`.

## Notifications & FCM

- **In-app:** `api/notifications`, `api/notifications/count`, `mark-read`; models `InAppNotification`, `FCMToken`.
- **Push:** Firebase Cloud Messaging. Client: `lib/fcm/`; server: `api/fcm/token`, WS server FCM. **Setup:** [fcm-setup.md](fcm-setup.md).

## i18n

- **next-intl.** Locales in `src/i18n/` (e.g. `ru.json`, `tr.json`). Used across pages and components.

## App version (mobile)

- **Backend:** `AppVersion` model; `api/app-version` returns min versions per platform.
- **Admin UI:** `pages/admin/app-version.page.tsx`.

## Other

- **Analytics:** `pages/analytics/`.
- **Server logs:** `api/server-logs`, `pages/server-logs/` (admin).
- **Slack:** Order bot and health/telekom alerts use `lib/slack/`; batch-runner sends health/balance alerts.
