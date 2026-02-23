/*
  Warnings:

  - You are about to drop the column `currentVersion` on the `AppVersion` table. All the data in the column will be lost.
  - You are about to drop the column `minVersion` on the `AppVersion` table. All the data in the column will be lost.
  - Added the required column `hardMinVersion` to the `AppVersion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `softMinVersion` to the `AppVersion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "MobilePlatforms" ADD VALUE 'ALL';

-- AlterTable
ALTER TABLE "AppVersion" DROP COLUMN "currentVersion",
DROP COLUMN "minVersion",
ADD COLUMN     "hardMinVersion" TEXT NOT NULL,
ADD COLUMN     "softMinVersion" TEXT NOT NULL;
