# Database

PostgreSQL + **Prisma**. Schema: `prisma/schema.prisma`. Migrations: `prisma/migrations/`.

## Commands (local dev)

- `yarn db:generate-dev` — regenerate Prisma client (uses `.env.local`).
- `yarn db:migrate-dev` — run pending migrations.
- `yarn db:studio-dev` — open Prisma Studio.

Requires `DATABASE_URL` in `.env.local`.

## Main models

| Model | Purpose |
|-------|--------|
| **User** | Auth; roles (`UserRole`); cart, orders, chat, FCM tokens |
| **CartItem** | User cart: product + quantity |
| **Category** | Tree (predecessor/successor); has products |
| **Product** | Name, description, images, price, category, brand, tags |
| **Brand** | Brand name; products |
| **UserOrder** / **UserOrderItem** | Customer orders and line items |
| **Prices** | Named price lists (e.g. TMT/USD) |
| **DollarRate** | Exchange rate for procurement |
| **ChatSession** / **ChatMessage** | Chat sessions and messages |
| **InAppNotification** | In-app notifications (chat, order status) |
| **FCMToken** | Device FCM tokens per user |
| **ProcurementSupplier**, **ProcurementProduct**, **ProcurementOrder*** | Procurement (suppliers, products, orders) |
| **AppVersion** | Min app versions per platform (iOS/Android) |

Relations and enums are in the schema. Use Prisma Studio or the schema file for full field lists.
