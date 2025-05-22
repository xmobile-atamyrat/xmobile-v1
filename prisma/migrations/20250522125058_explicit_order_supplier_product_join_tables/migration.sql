/*
  Warnings:

  - You are about to drop the `_CalculationHistoryProcurementProducts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_CalculationHistorySuppliers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_CalculationHistoryProcurementProducts" DROP CONSTRAINT "_CalculationHistoryProcurementProducts_A_fkey";

-- DropForeignKey
ALTER TABLE "_CalculationHistoryProcurementProducts" DROP CONSTRAINT "_CalculationHistoryProcurementProducts_B_fkey";

-- DropForeignKey
ALTER TABLE "_CalculationHistorySuppliers" DROP CONSTRAINT "_CalculationHistorySuppliers_A_fkey";

-- DropForeignKey
ALTER TABLE "_CalculationHistorySuppliers" DROP CONSTRAINT "_CalculationHistorySuppliers_B_fkey";

-- DropTable
DROP TABLE "_CalculationHistoryProcurementProducts";

-- DropTable
DROP TABLE "_CalculationHistorySuppliers";

-- CreateTable
CREATE TABLE "ProcurementOrderSupplier" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcurementOrderSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementOrderProduct" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcurementOrderProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementOrderSupplier_orderId_supplierId_key" ON "ProcurementOrderSupplier"("orderId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementOrderProduct_orderId_productId_key" ON "ProcurementOrderProduct"("orderId", "productId");

-- AddForeignKey
ALTER TABLE "ProcurementOrderSupplier" ADD CONSTRAINT "ProcurementOrderSupplier_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProcurementOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementOrderSupplier" ADD CONSTRAINT "ProcurementOrderSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "ProcurementSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementOrderProduct" ADD CONSTRAINT "ProcurementOrderProduct_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProcurementOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementOrderProduct" ADD CONSTRAINT "ProcurementOrderProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
