-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "InAppNotification" ADD COLUMN     "deliveryStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill: rows that predate delivery tracking were already handled by the original
-- fire-and-forget send. Mark them SENT so the retry job never re-sends history.
UPDATE "InAppNotification" SET "deliveryStatus" = 'SENT' WHERE "deliveryStatus" = 'PENDING';

-- CreateTable
CREATE TABLE "PushRetryConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "baseDelaySec" INTEGER NOT NULL DEFAULT 30,
    "backoffMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "maxDelaySec" INTEGER NOT NULL DEFAULT 3600,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushRetryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InAppNotification_deliveryStatus_nextRetryAt_idx" ON "InAppNotification"("deliveryStatus", "nextRetryAt");
