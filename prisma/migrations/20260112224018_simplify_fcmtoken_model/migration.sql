/*
  Warnings:

  - You are about to drop the column `failureCount` on the `FCMToken` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `FCMToken` table. All the data in the column will be lost.
  - You are about to drop the column `lastFailedAt` on the `FCMToken` table. All the data in the column will be lost.
  - You are about to drop the column `lastUsedAt` on the `FCMToken` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[deviceInfo]` on the table `FCMToken` will be added. If there are existing duplicate values, this will fail.
  - Made the column `deviceInfo` on table `FCMToken` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "FCMToken_lastUsedAt_idx";

-- DropIndex
DROP INDEX "FCMToken_userId_isActive_idx";

-- AlterTable
ALTER TABLE "FCMToken" DROP COLUMN "failureCount",
DROP COLUMN "isActive",
DROP COLUMN "lastFailedAt",
DROP COLUMN "lastUsedAt",
ALTER COLUMN "deviceInfo" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "FCMToken_deviceInfo_key" ON "FCMToken"("deviceInfo");
