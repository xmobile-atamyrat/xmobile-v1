/*
  Warnings:

  - You are about to drop the `CalculationHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProcurementProduct` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Supplier` table. If the table is not empty, all the data it contains will be lost.
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
DROP TABLE "CalculationHistory";

-- DropTable
DROP TABLE "ProcurementProduct";

-- DropTable
DROP TABLE "Supplier";

-- DropTable
DROP TABLE "_CalculationHistoryProcurementProducts";

-- DropTable
DROP TABLE "_CalculationHistorySuppliers";
