/*
  Warnings:

  - The primary key for the `Prices` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Made the column `id` on table `Prices` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Prices_name_key";

-- AlterTable
ALTER TABLE "Prices" DROP CONSTRAINT "Prices_pkey",
ALTER COLUMN "id" SET NOT NULL,
ADD CONSTRAINT "Prices_pkey" PRIMARY KEY ("id");
