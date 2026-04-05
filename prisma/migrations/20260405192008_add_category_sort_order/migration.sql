-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Category_predecessorId_sortOrder_idx" ON "Category"("predecessorId", "sortOrder");
