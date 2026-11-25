-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PRICE_STALENESS';

-- AlterTable
ALTER TABLE "Prices" ADD COLUMN     "priceCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing prices: treat the last system/admin write as the last check.
UPDATE "Prices" SET "priceCheckedAt" = "updatedAt";

-- CreateIndex
CREATE INDEX "Prices_priceCheckedAt_idx" ON "Prices"("priceCheckedAt");
