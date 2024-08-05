/*
  Warnings:

  - Added the required column `tagImages` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "tagImages" JSONB NOT NULL,
ADD COLUMN     "tags" TEXT[];
