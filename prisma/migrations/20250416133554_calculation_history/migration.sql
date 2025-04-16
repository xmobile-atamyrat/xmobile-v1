-- CreateTable
CREATE TABLE "CalculationHistory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalculationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalculationEntry" (
    "id" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "calculationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "procurementProductId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalculationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CalculationHistorySuppliers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_CalculationHistoryProcurementProducts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_CalculationHistorySuppliers_AB_unique" ON "_CalculationHistorySuppliers"("A", "B");

-- CreateIndex
CREATE INDEX "_CalculationHistorySuppliers_B_index" ON "_CalculationHistorySuppliers"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CalculationHistoryProcurementProducts_AB_unique" ON "_CalculationHistoryProcurementProducts"("A", "B");

-- CreateIndex
CREATE INDEX "_CalculationHistoryProcurementProducts_B_index" ON "_CalculationHistoryProcurementProducts"("B");

-- AddForeignKey
ALTER TABLE "CalculationEntry" ADD CONSTRAINT "CalculationEntry_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "CalculationHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationEntry" ADD CONSTRAINT "CalculationEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationEntry" ADD CONSTRAINT "CalculationEntry_procurementProductId_fkey" FOREIGN KEY ("procurementProductId") REFERENCES "ProcurementProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalculationHistorySuppliers" ADD CONSTRAINT "_CalculationHistorySuppliers_A_fkey" FOREIGN KEY ("A") REFERENCES "CalculationHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalculationHistorySuppliers" ADD CONSTRAINT "_CalculationHistorySuppliers_B_fkey" FOREIGN KEY ("B") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalculationHistoryProcurementProducts" ADD CONSTRAINT "_CalculationHistoryProcurementProducts_A_fkey" FOREIGN KEY ("A") REFERENCES "CalculationHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalculationHistoryProcurementProducts" ADD CONSTRAINT "_CalculationHistoryProcurementProducts_B_fkey" FOREIGN KEY ("B") REFERENCES "ProcurementProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
