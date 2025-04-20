/*
  Warnings:

  - The `quantities` column on the `CalculationHistory` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "CalculationHistory" DROP COLUMN "quantities",
ADD COLUMN     "quantities" JSONB;
