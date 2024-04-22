/*
  Warnings:

  - You are about to drop the column `predId` on the `Category` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[predecessorId]` on the table `Category` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_predId_fkey";

-- DropIndex
DROP INDEX "Category_predId_key";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "predId",
ADD COLUMN     "predecessorId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Category_predecessorId_key" ON "Category"("predecessorId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
