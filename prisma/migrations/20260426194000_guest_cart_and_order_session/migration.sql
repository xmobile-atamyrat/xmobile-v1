-- AlterTable
ALTER TABLE "UserOrder" ADD COLUMN "guestSessionId" TEXT;

-- CreateTable
CREATE TABLE "GuestCartItem" (
    "id" TEXT NOT NULL,
    "guestSessionId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestCartItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestCartItem_guestSessionId_idx" ON "GuestCartItem"("guestSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestCartItem_guestSessionId_productId_key" ON "GuestCartItem"("guestSessionId", "productId");

-- CreateIndex
CREATE INDEX "UserOrder_guestSessionId_idx" ON "UserOrder"("guestSessionId");

-- AddForeignKey
ALTER TABLE "GuestCartItem" ADD CONSTRAINT "GuestCartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
