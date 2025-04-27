/*
  Warnings:

  - The `status` column on the `ChatSession` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('CLOSED', 'OPEN');

-- AlterTable
ALTER TABLE "ChatSession" DROP COLUMN "status",
ADD COLUMN     "status" "ChatStatus" NOT NULL DEFAULT 'OPEN';
