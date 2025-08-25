-- AlterTable
ALTER TABLE "ProcurementOrderProduct" ADD COLUMN     "bulkProductPercent" DOUBLE PRECISION,
ADD COLUMN     "bulkProductPrice" DOUBLE PRECISION,
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "finalBulkPrice" DOUBLE PRECISION,
ADD COLUMN     "finalSinglePrice" DOUBLE PRECISION,
ADD COLUMN     "orderReceived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "singleProductPercent" DOUBLE PRECISION,
ADD COLUMN     "singleProductPrice" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ProductPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "originalPrice" DOUBLE PRECISION,
    "originalCurrency" "CURRENCY",
    "bulkPrice" DOUBLE PRECISION,
    "singlePrice" DOUBLE PRECISION,
    "lastUpdatedFromOrderId" TEXT,
    "lastUpdatedFromProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductPrice_productId_key" ON "ProductPrice"("productId");

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
