/*
  Warnings:

  - You are about to drop the column `imgUrl` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "imgUrl",
ADD COLUMN     "imgUrls" TEXT[];
