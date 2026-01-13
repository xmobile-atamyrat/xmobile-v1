/*
  Warnings:

  - A unique constraint covering the columns `[userId,productId,selectedTag]` on the table `CartItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "CartItem_userId_productId_key";

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "selectedTag" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_userId_productId_selectedTag_key" ON "CartItem"("userId", "productId", "selectedTag");
