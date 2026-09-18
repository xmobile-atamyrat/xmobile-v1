-- AlterTable
ALTER TABLE "Prices" ADD COLUMN     "productId" TEXT;

-- CreateIndex
CREATE INDEX "Prices_productId_idx" ON "Prices"("productId");

-- AddForeignKey
ALTER TABLE "Prices" ADD CONSTRAINT "Prices_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
