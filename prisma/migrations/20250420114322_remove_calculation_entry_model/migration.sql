/*
  Warnings:

  - You are about to drop the `CalculationEntry` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CalculationEntry" DROP CONSTRAINT "CalculationEntry_calculationId_fkey";

-- DropForeignKey
ALTER TABLE "CalculationEntry" DROP CONSTRAINT "CalculationEntry_procurementProductId_fkey";

-- DropForeignKey
ALTER TABLE "CalculationEntry" DROP CONSTRAINT "CalculationEntry_supplierId_fkey";

-- AlterTable
ALTER TABLE "CalculationHistory" ADD COLUMN     "prices" JSONB,
ADD COLUMN     "quantities" INTEGER[];

-- DropTable
DROP TABLE "CalculationEntry";
