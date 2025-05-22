-- DropForeignKey
ALTER TABLE "ProcurementOrderProduct" DROP CONSTRAINT "ProcurementOrderProduct_orderId_fkey";

-- DropForeignKey
ALTER TABLE "ProcurementOrderProduct" DROP CONSTRAINT "ProcurementOrderProduct_productId_fkey";

-- DropForeignKey
ALTER TABLE "ProcurementOrderSupplier" DROP CONSTRAINT "ProcurementOrderSupplier_orderId_fkey";

-- DropForeignKey
ALTER TABLE "ProcurementOrderSupplier" DROP CONSTRAINT "ProcurementOrderSupplier_supplierId_fkey";

-- AddForeignKey
ALTER TABLE "ProcurementOrderSupplier" ADD CONSTRAINT "ProcurementOrderSupplier_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProcurementOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementOrderSupplier" ADD CONSTRAINT "ProcurementOrderSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "ProcurementSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementOrderProduct" ADD CONSTRAINT "ProcurementOrderProduct_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProcurementOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementOrderProduct" ADD CONSTRAINT "ProcurementOrderProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
