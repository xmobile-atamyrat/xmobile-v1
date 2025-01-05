/*
  Warnings:

  - A unique constraint covering the columns `[userId,productId]` on the table `CartItems` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CartItems_userId_productId_key" ON "CartItems"("userId", "productId");
