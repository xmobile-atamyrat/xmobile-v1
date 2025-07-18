/*
  Warnings:

  - The `currency` column on the `DollarRate` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `currency` column on the `ProcurementOrder` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "CURRENCY" AS ENUM ('USD', 'TMT', 'AED', 'CNY');

-- DropForeignKey
ALTER TABLE "ProcurementOrder" DROP CONSTRAINT "ProcurementOrder_currency_fkey";

-- AlterTable
ALTER TABLE "DollarRate" DROP COLUMN "currency",
ADD COLUMN     "currency" "CURRENCY" NOT NULL DEFAULT 'TMT';

-- AlterTable
ALTER TABLE "ProcurementOrder" DROP COLUMN "currency",
ADD COLUMN     "currency" "CURRENCY" NOT NULL DEFAULT 'TMT';

-- CreateIndex
CREATE UNIQUE INDEX "DollarRate_currency_key" ON "DollarRate"("currency");

-- AddForeignKey
ALTER TABLE "ProcurementOrder" ADD CONSTRAINT "ProcurementOrder_currency_fkey" FOREIGN KEY ("currency") REFERENCES "DollarRate"("currency") ON DELETE CASCADE ON UPDATE CASCADE;
