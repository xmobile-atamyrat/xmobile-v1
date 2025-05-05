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
CREATE TABLE "ProcurementProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementProduct_pkey" PRIMARY KEY ("id")
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
ALTER TABLE "_CalculationHistorySuppliers" ADD CONSTRAINT "_CalculationHistorySuppliers_A_fkey" FOREIGN KEY ("A") REFERENCES "ProcurementOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalculationHistorySuppliers" ADD CONSTRAINT "_CalculationHistorySuppliers_B_fkey" FOREIGN KEY ("B") REFERENCES "ProcurementSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalculationHistoryProcurementProducts" ADD CONSTRAINT "_CalculationHistoryProcurementProducts_A_fkey" FOREIGN KEY ("A") REFERENCES "ProcurementOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalculationHistoryProcurementProducts" ADD CONSTRAINT "_CalculationHistoryProcurementProducts_B_fkey" FOREIGN KEY ("B") REFERENCES "ProcurementProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
