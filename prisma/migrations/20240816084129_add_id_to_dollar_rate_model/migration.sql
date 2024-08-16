/*
  Warnings:

  - The primary key for the `DollarRate` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropIndex
DROP INDEX "DollarRate_rate_key";

-- AlterTable
ALTER TABLE "DollarRate" DROP CONSTRAINT "DollarRate_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "DollarRate_pkey" PRIMARY KEY ("id");
