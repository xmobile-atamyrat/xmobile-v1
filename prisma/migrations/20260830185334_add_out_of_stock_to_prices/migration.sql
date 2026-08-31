-- AlterTable
ALTER TABLE "Prices" ADD COLUMN     "isOutOfStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "outOfStockAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "outOfStockAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Product_outOfStockAt_idx" ON "Product"("outOfStockAt");
