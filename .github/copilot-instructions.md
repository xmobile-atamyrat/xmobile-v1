# XMobile Copilot Instructions

## Project Overview

XMobile is a full-stack e-commerce platform built in Turkmenistan with:

- **Web**: Next.js 14 frontend (TypeScript) with MUI components
- **Mobile**: React Native wrapper that embeds the web app via WebView
- **Backend**: Next.js API routes + WebSocket server (separate Node process)
- **Database**: PostgreSQL with Prisma ORM
- **Notifications**: FCM + WebSocket + in-app notification system
- **i18n**: Multi-language support (5 locales: en, ru, tk, ch, tr)

## Architecture

### Frontend Stack (`src/pages/`)

- **Page Routing**: Custom `.page.tsx`/`.page.ts` extensions (see `next.config.mjs`)
- **Context Providers**: Stacked in `_app.page.tsx` for global state:
  - `UserContext` - authentication & user data
  - `WebSocketContext` - real-time chat & notifications
  - `ChatContext` - chat session management
  - `NotificationContext` - in-app notifications (separate from FCM)
  - `CategoryContext` - product categories (hierarchical with predecessors)
  - `ProductContext` - current product details
  - `DollarRateContext` - real-time currency rates
  - `NetworkContext` - network quality detection
  - `PlatformContext` - detects if running in React Native WebView

### Backend API (`src/pages/api/`)

- **API Middleware**: `withAuth()` wrapper for JWT validation (see `authMiddleware.ts`)
- **Bypass Paths**: `GET /api/prices`, `/api/prices/rate`, `/api/brand` don't require auth
- **Token System**: JWT access tokens in headers, refresh tokens in HTTP-only cookies
- **Constants**: Token secrets & cookie names in `src/pages/lib/constants.ts`

### WebSocket Server (`src/ws-server/`)

- **Separate Process**: Started with `yarn dev:ws`, uses `ts-node`
- **Real-time Features**:
  - Chat messages with ACK/read receipts
  - Notifications delivery (FCM fallback if offline)
  - User connection tracking via `connections` Map
- **Auth**: Token verification on connection upgrade using cookies/headers
- **Message Schema**: Validated with Zod (see `MessageSchema`)

### Database (`prisma/`)

- **Migrations**: 30+ migrations tracked in `prisma/migrations/`
- **Key Models**:
  - `User` - email/password auth, roles (FREE/ADMIN/SUPERUSER)
  - `Product` - categories, brands, prices; `imgUrls` is JSON array
  - `Category` - hierarchical with `predecessorId` self-relation
  - `CartItem` - unique constraint on (userId, productId)
  - `UserOrder` - status tracking (PENDING→PAID→SHIPPED→DELIVERED)
  - `ChatSession` - PENDING/ACTIVE/CLOSED status
  - `Price` - separate pricing model with `DollarRate` conversion
  - `InAppNotification` - tracks CHAT_MESSAGE or ORDER_STATUS_UPDATE

## Critical Developer Workflows

### Development

```bash
# Start everything
yarn install
docker-compose up -d db  # PostgreSQL
yarn db:generate        # Prisma client
yarn db:migrate         # Apply migrations
yarn dev                # Next.js on port 3003
yarn dev:ws             # WebSocket in another terminal
```

### Database

- **View Data**: `yarn db:studio-dev` opens Prisma Studio
- **New Migration**: Modify `schema.prisma` → `yarn db:migrate-dev` (creates migration files)
- **Check Status**: `yarn db:history-dev` shows migration state

### Translations

- **Add Key**: `yarn run "Add translation row"` task (prompts for key/value)
  - Uses Google Translate API to auto-translate to all 5 languages
  - Files: `src/i18n/{en,ru,tk,ch,tr}.json`
- **Remove Key**: `yarn run "Delete translation row"` task

### Build & Deployment

- **Web**: `yarn build` → `yarn start` (Next.js production server)
- **WebSocket**: `yarn build:ws` → `yarn start:ws` (Node process)
- **CI/CD**: Terraform/SSH deployment (see scripts directory)

## Key Patterns & Conventions

### API Response Wrapper

All API endpoints return `ResponseApi<T>`:

```typescript
interface ResponseApi<K = any> {
  success: boolean;
  data?: K;
  message?: string;
}
```

### Authentication Flow

1. Client calls `/api/user/signin` or `/signup`
2. Server returns JWT access token + refresh token (HTTP-only cookie)
3. Client includes `Authorization: Bearer <token>` in requests
4. On expiry, server validates refresh token and issues new pair
5. `withAuth()` middleware enforces this for protected routes

### Real-time Chat (WebSocket)

- Client connects with valid token
- Sends `ChatMessage` objects with `sessionId`
- Receives `ack` (confirm delivery) + `read` (mark as read)
- Server broadcasts to all users in session via `connections` Map
- Falls back to FCM notification if user offline

### Product Pricing

- `Product.price` is string (legacy), `cachedPrice` is float (current)
- `Price` model stores historical rates
- `DollarRate` model: `{rate: float, createdAt}`
- Always fetch rates from `/api/prices/rate` before displaying

### Notification System (3 Types)

1. **WebSocket Chat**: Real-time message delivery + FCM fallback
2. **FCM Push**: Firebase Cloud Messaging for mobile (see `fcmService.ts`)
3. **In-App**: Persistent `InAppNotification` entries in DB (read via socket or HTTP)

### React Native Integration

- `App.tsx` embeds `WebAppScreen` (WebView wrapper)
- Detects if running in RN via `isWebView()` function
- Skips Service Worker registration in WebView
- Platform context allows UI to adapt (e.g., hide install prompts)

### i18n Implementation

- Uses `next-intl` library
- Locale detected from cookie (`LOCALE_COOKIE_NAME`)
- Default locale: `ru` (see `next.config.mjs`)
- Translation keys accessed via `useTranslations()` hook

## File Organization

```
src/
  pages/api/         → API routes (next-connect + withAuth)
  pages/components/  → React components (Appbar, Drawer, etc.)
  pages/lib/         → Context providers + utilities + types
  pages/[feature]/   → Feature pages (category, product, user, cart, etc.)
  ws-server/         → Separate WebSocket process
  lib/               → Shared (fcm, slack, ApiEndpoints)
  i18n/              → Translation JSONs
  styles/            → CSS + classMaps (tailwind)
```

## Important Constants & Locations

| Item                  | Location                                               |
| --------------------- | ------------------------------------------------------ |
| API base URL          | `src/lib/ApiEndpoints.ts`                              |
| Auth secrets          | `src/pages/api/utils/tokenUtils.ts`                    |
| Cookie names          | `src/pages/lib/constants.ts`                           |
| Type definitions      | `src/pages/lib/types.ts`                               |
| Prisma client         | `src/lib/dbClient.ts` (singleton)                      |
| WebSocket connections | `src/ws-server/index.ts` (Map<userId, Set<WebSocket>>) |

## Avoid These Pitfalls

- ❌ Don't query Prisma in API routes without `withAuth()` - verify user first
- ❌ Don't modify `prisma/schema.prisma` without creating a migration
- ❌ Don't add translations directly to JSON - use the task scripts
- ❌ Don't assume users are authenticated on GET requests (check BYPASS_AUTH_PATHS)
- ❌ Don't return passwords in API responses (use `Omit<User, 'password'>`)
- ❌ The WebSocket server is a SEPARATE process - must run alongside Next.js

## External Dependencies

- **Firebase Admin** (FCM notifications)
- **Slack API** (notifications/alerts)
- **Prisma** (ORM + migrations)
- **MUI 5** (component library)
- **next-intl** (i18n)
- **SWR** (client-side data fetching)
- **WebSocket** (real-time server)
