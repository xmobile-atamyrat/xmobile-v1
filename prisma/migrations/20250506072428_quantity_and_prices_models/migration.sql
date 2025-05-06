/*
  Warnings:

  - You are about to drop the column `prices` on the `ProcurementOrder` table. All the data in the column will be lost.
  - You are about to drop the column `quantities` on the `ProcurementOrder` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProcurementOrder" DROP COLUMN "prices",
DROP COLUMN "quantities";

-- CreateTable
CREATE TABLE "ProcurementOrderProductQuantity" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementOrderProductQuantity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementSupplierProductPrice" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementSupplierProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementOrderProductQuantity_orderId_productId_key" ON "ProcurementOrderProductQuantity"("orderId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementSupplierProductPrice_supplierId_productId_orderI_key" ON "ProcurementSupplierProductPrice"("supplierId", "productId", "orderId");

-- AddForeignKey
ALTER TABLE "ProcurementOrderProductQuantity" ADD CONSTRAINT "ProcurementOrderProductQuantity_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProcurementOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementOrderProductQuantity" ADD CONSTRAINT "ProcurementOrderProductQuantity_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementSupplierProductPrice" ADD CONSTRAINT "ProcurementSupplierProductPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "ProcurementSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementSupplierProductPrice" ADD CONSTRAINT "ProcurementSupplierProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementSupplierProductPrice" ADD CONSTRAINT "ProcurementSupplierProductPrice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProcurementOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
