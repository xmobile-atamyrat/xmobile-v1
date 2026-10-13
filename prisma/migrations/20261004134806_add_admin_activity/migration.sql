CREATE TYPE "AdminActivityEntity" AS ENUM ('PRODUCT', 'PRICE', 'CURRENCY_RATE', 'CATEGORY', 'ORDER', 'BANNER', 'BRAND', 'COLOR');

CREATE TYPE "AdminActivityAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'REORDER');

ALTER TABLE "User" ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

CREATE TABLE "AdminActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "entity" "AdminActivityEntity" NOT NULL,
    "action" "AdminActivityAction" NOT NULL,
    "targetId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminActivity_createdAt_idx" ON "AdminActivity"("createdAt" DESC);

CREATE INDEX "AdminActivity_userId_createdAt_idx" ON "AdminActivity"("userId", "createdAt" DESC);

CREATE INDEX "AdminActivity_entity_createdAt_idx" ON "AdminActivity"("entity", "createdAt" DESC);

CREATE INDEX "AdminActivity_targetId_createdAt_idx" ON "AdminActivity"("targetId", "createdAt" DESC);

CREATE INDEX "ChatMessage_senderId_createdAt_idx" ON "ChatMessage"("senderId", "createdAt");

ALTER TABLE "AdminActivity" ADD CONSTRAINT "AdminActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
