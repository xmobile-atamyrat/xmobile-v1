-- AlterTable
ALTER TABLE "Prices" ADD COLUMN     "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "Prices_categoryId_idx" ON "Prices"("categoryId");

-- AddForeignKey
ALTER TABLE "Prices" ADD CONSTRAINT "Prices_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
