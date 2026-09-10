-- AlterTable
ALTER TABLE "Prices" ADD COLUMN     "outOfStockAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "outOfStockAt" TIMESTAMP(3);

-- Carry the boolean forward before dropping it. Every product currently marked
-- out of stock has no timestamp — the column did not exist until the statement
-- above — so without this the whole sold-out catalog silently goes back on sale.
--
-- `updatedAt` rather than now(): it is never earlier than the moment the product
-- went out of stock, because that flip was itself a write. Anything measuring a
-- retention window against this column can therefore only ever act later than
-- the truth, never sooner.
UPDATE "Product"
SET "outOfStockAt" = "updatedAt"
WHERE "isOutOfStock" = true;

-- DropColumn
ALTER TABLE "Product" DROP COLUMN "isOutOfStock";

-- CreateIndex
CREATE INDEX "Product_outOfStockAt_idx" ON "Product"("outOfStockAt");
