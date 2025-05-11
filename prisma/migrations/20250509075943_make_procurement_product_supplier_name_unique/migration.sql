/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `ProcurementProduct` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `ProcurementSupplier` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ProcurementProduct_name_key" ON "ProcurementProduct"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementSupplier_name_key" ON "ProcurementSupplier"("name");
