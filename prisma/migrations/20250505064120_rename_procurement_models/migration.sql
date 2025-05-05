/*
  Warnings:

  - You are about to drop the `CalculationHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Supplier` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_CalculationHistoryProcurementProducts" DROP CONSTRAINT "_CalculationHistoryProcurementProducts_A_fkey";

-- DropForeignKey
ALTER TABLE "_CalculationHistorySuppliers" DROP CONSTRAINT "_CalculationHistorySuppliers_A_fkey";

-- DropForeignKey
ALTER TABLE "_CalculationHistorySuppliers" DROP CONSTRAINT "_CalculationHistorySuppliers_B_fkey";

-- DropTable
DROP TABLE "CalculationHistory";

-- DropTable
DROP TABLE "Supplier";

-- CreateTable
CREATE TABLE "ProcurementSupplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementOrder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prices" JSONB,
    "quantities" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementOrder_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "_CalculationHistorySuppliers" ADD CONSTRAINT "_CalculationHistorySuppliers_A_fkey" FOREIGN KEY ("A") REFERENCES "ProcurementOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalculationHistorySuppliers" ADD CONSTRAINT "_CalculationHistorySuppliers_B_fkey" FOREIGN KEY ("B") REFERENCES "ProcurementSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalculationHistoryProcurementProducts" ADD CONSTRAINT "_CalculationHistoryProcurementProducts_A_fkey" FOREIGN KEY ("A") REFERENCES "ProcurementOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
