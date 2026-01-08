-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ORDER_STATUS_UPDATE';

-- AlterTable
ALTER TABLE "InAppNotification" ADD COLUMN     "orderId" TEXT,
ALTER COLUMN "sessionId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "InAppNotification_orderId_idx" ON "InAppNotification"("orderId");

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "UserOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
