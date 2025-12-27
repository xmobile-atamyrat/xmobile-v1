-- DropForeignKey
ALTER TABLE "UserOrder" DROP CONSTRAINT "UserOrder_userId_fkey";

-- AlterTable
ALTER TABLE "UserOrder" ADD COLUMN     "userEmail" TEXT,
ADD COLUMN     "userName" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "UserOrder_userName_idx" ON "UserOrder"("userName");

-- CreateIndex
CREATE INDEX "UserOrder_userEmail_idx" ON "UserOrder"("userEmail");

-- CreateIndex
CREATE INDEX "UserOrder_deliveryAddress_idx" ON "UserOrder"("deliveryAddress");

-- CreateIndex
CREATE INDEX "UserOrder_deliveryPhone_idx" ON "UserOrder"("deliveryPhone");

-- AddForeignKey
ALTER TABLE "UserOrder" ADD CONSTRAINT "UserOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
