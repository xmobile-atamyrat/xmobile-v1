-- AlterTable
ALTER TABLE "DollarRate" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

UPDATE "DollarRate"
SET "isDefault" = true
WHERE "id" = (
  SELECT "id" FROM "DollarRate" WHERE "currency" = 'TMT' ORDER BY "id" ASC LIMIT 1
);

-- AlterTable
ALTER TABLE "ProcurementOrder" ADD COLUMN "dollarRateId" INTEGER;

UPDATE "ProcurementOrder" o
SET "dollarRateId" = (
  SELECT r."id" FROM "DollarRate" r
  WHERE r."currency" = o."currency"
  ORDER BY r."isDefault" DESC, r."id" ASC
  LIMIT 1
);

-- DropForeignKey
ALTER TABLE "ProcurementOrder" DROP CONSTRAINT "ProcurementOrder_currency_fkey";

-- DropIndex
DROP INDEX "DollarRate_currency_key";

-- CreateIndex
CREATE UNIQUE INDEX "DollarRate_currency_name_key" ON "DollarRate"("currency", "name");

-- CreateIndex
CREATE INDEX "DollarRate_isDefault_idx" ON "DollarRate"("isDefault");

-- CreateIndex
CREATE INDEX "ProcurementOrder_dollarRateId_idx" ON "ProcurementOrder"("dollarRateId");

-- AddForeignKey
ALTER TABLE "ProcurementOrder" ADD CONSTRAINT "ProcurementOrder_dollarRateId_fkey" FOREIGN KEY ("dollarRateId") REFERENCES "DollarRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Prices" ADD COLUMN "dollarRateId" INTEGER;

UPDATE "Prices"
SET "dollarRateId" = (SELECT "id" FROM "DollarRate" WHERE "isDefault" = true LIMIT 1);

-- CreateIndex
CREATE INDEX "Prices_dollarRateId_idx" ON "Prices"("dollarRateId");

-- AddForeignKey
ALTER TABLE "Prices" ADD CONSTRAINT "Prices_dollarRateId_fkey" FOREIGN KEY ("dollarRateId") REFERENCES "DollarRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
