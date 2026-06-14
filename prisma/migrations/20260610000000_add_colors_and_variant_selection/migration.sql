-- DropIndex
DROP INDEX "CartItem_userId_productId_key";

-- DropIndex
DROP INDEX "GuestCartItem_guestSessionId_productId_key";

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "selectedVariant" TEXT;

-- AlterTable
ALTER TABLE "GuestCartItem" ADD COLUMN     "selectedVariant" TEXT;

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

-- CreateTable
CREATE TABLE "_ColorsToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Colors_name_key" ON "Colors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Colors_hex_key" ON "Colors"("hex");

-- CreateIndex
CREATE UNIQUE INDEX "_ColorsToProduct_AB_unique" ON "_ColorsToProduct"("A", "B");

-- CreateIndex
CREATE INDEX "_ColorsToProduct_B_index" ON "_ColorsToProduct"("B");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_userId_productId_selectedVariant_key" ON "CartItem"("userId", "productId", "selectedVariant");

-- CreateIndex
CREATE UNIQUE INDEX "GuestCartItem_guestSessionId_productId_selectedVariant_key" ON "GuestCartItem"("guestSessionId", "productId", "selectedVariant");

-- AddForeignKey
ALTER TABLE "_ColorsToProduct" ADD CONSTRAINT "_ColorsToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "Colors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ColorsToProduct" ADD CONSTRAINT "_ColorsToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
