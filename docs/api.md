# API

REST API lives under **`src/pages/api/`**. File name `*.page.ts` → route by path (e.g. `api/order/index.page.ts` → `/api/order`).

## Conventions

- **Handler:** next-connect; CORS via `addCors` wrapper.
- **Auth:** Most routes use `withAuth` from `api/utils/authMiddleware.ts`. It reads:
  - `Authorization: Bearer <accessToken>`, or
  - Refresh token in cookie (`AUTH_REFRESH_COOKIE_NAME`).
- **Public GET (no auth):** `GET /api/prices`, `GET /api/prices/rate`, `GET /api/brand`.
- **Validation:** Zod in request handlers where used.

## Main endpoint groups

| Area | Path | Notes |
|------|------|--------|
| Auth | `api/user/signin`, `signup`, `api/user/index` (refresh) | JWT issue/refresh |
| Cart | `api/cart` | CRUD cart items (auth) |
| Orders | `api/order`, `api/order/[id]` | Create, list, get (auth) |
| Admin orders | `api/order/admin`, `api/order/admin/[id]` | List/update orders (admin) |
| Products | `api/product`, `api/product/new`, `api/category` | List, create (admin) |
| Prices | `api/prices`, `api/prices/rate` | Prices list, rate (rate public) |
| Brands | `api/brand` | List (auth) |
| Chat | `api/chat/session`, `sessionActions`, `api/chat/message` | Sessions and messages (auth) |
| Notifications | `api/notifications`, `api/notifications/count`, `mark-read` | In-app notifications (auth) |
| FCM | `api/fcm/token` | Register FCM token (auth) |
| Procurement | `api/procurement/supplier`, `product`, `api/procurement/order/*` | Suppliers, products, orders (auth) |
| App version | `api/app-version` | Min versions for mobile (auth) |
| Server logs | `api/server-logs`, `api/server-logs/[filename]` | Admin log access |
| Health | `api/ping` | No auth |

Shared auth types: `AuthenticatedRequest` (req with `userId`, `grade`). Admin checks use `grade === ADMIN` (or equivalent) where needed.
