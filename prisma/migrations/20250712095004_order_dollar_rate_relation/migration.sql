/*
  Warnings:

  - A unique constraint covering the columns `[currency]` on the table `DollarRate` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DollarRate" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'TMT';

-- AlterTable
ALTER TABLE "ProcurementOrder" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'TMT';

-- CreateIndex
CREATE UNIQUE INDEX "DollarRate_currency_key" ON "DollarRate"("currency");

-- AddForeignKey
ALTER TABLE "ProcurementOrder" ADD CONSTRAINT "ProcurementOrder_currency_fkey" FOREIGN KEY ("currency") REFERENCES "DollarRate"("currency") ON DELETE CASCADE ON UPDATE CASCADE;
