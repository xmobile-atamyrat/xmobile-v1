-- CreateEnum
CREATE TYPE "OrderPriceColor" AS ENUM ('white', 'orange', 'green');

-- AlterTable
ALTER TABLE "ProcurementSupplierProductPrice" ADD COLUMN     "color" "OrderPriceColor" DEFAULT 'white';
