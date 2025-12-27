-- CreateEnum
CREATE TYPE "UserOrderStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'USER_CANCELLED', 'ADMIN_CANCELLED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT;

-- CreateTable
CREATE TABLE "UserOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "UserOrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalPrice" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "deliveryPhone" TEXT NOT NULL,
    "notes" TEXT,
    "adminNotes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOrderItem" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "productName" TEXT NOT NULL,
    "productPrice" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserOrder_orderNumber_key" ON "UserOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "UserOrder_userId_idx" ON "UserOrder"("userId");

-- CreateIndex
CREATE INDEX "UserOrder_status_idx" ON "UserOrder"("status");

-- CreateIndex
CREATE INDEX "UserOrder_createdAt_idx" ON "UserOrder"("createdAt");

-- CreateIndex
CREATE INDEX "UserOrderItem_orderId_idx" ON "UserOrderItem"("orderId");

-- AddForeignKey
ALTER TABLE "UserOrder" ADD CONSTRAINT "UserOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOrderItem" ADD CONSTRAINT "UserOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "UserOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOrderItem" ADD CONSTRAINT "UserOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
