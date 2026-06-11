-- DropIndex
DROP INDEX "CartItem_userId_productId_key";

-- DropIndex
DROP INDEX "GuestCartItem_guestSessionId_productId_key";

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "selectedVariant" TEXT;

-- AlterTable
ALTER TABLE "GuestCartItem" ADD COLUMN     "selectedVariant" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rams" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "storages" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "UserOrderItem" ADD COLUMN     "selectedVariant" TEXT;

-- CreateTable
CREATE TABLE "Colors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Colors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Colors_name_key" ON "Colors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Colors_hex_key" ON "Colors"("hex");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_userId_productId_selectedVariant_key" ON "CartItem"("userId", "productId", "selectedVariant");

-- CreateIndex
CREATE UNIQUE INDEX "GuestCartItem_guestSessionId_productId_selectedVariant_key" ON "GuestCartItem"("guestSessionId", "productId", "selectedVariant");
