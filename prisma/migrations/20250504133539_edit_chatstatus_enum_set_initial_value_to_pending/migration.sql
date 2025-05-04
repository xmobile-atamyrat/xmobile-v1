/*
  Warnings:

  - The values [OPEN] on the enum `ChatStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `userId` on the `ChatSession` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ChatStatus_new" AS ENUM ('CLOSED', 'ACTIVE', 'PENDING');
ALTER TABLE "ChatSession" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ChatSession" ALTER COLUMN "status" TYPE "ChatStatus_new" USING ("status"::text::"ChatStatus_new");
ALTER TYPE "ChatStatus" RENAME TO "ChatStatus_old";
ALTER TYPE "ChatStatus_new" RENAME TO "ChatStatus";
DROP TYPE "ChatStatus_old";
ALTER TABLE "ChatSession" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "ChatSession" DROP CONSTRAINT "ChatSession_userId_fkey";

-- AlterTable
ALTER TABLE "ChatSession" DROP COLUMN "userId",
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "_ChatSessionToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ChatSessionToUser_AB_unique" ON "_ChatSessionToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_ChatSessionToUser_B_index" ON "_ChatSessionToUser"("B");

-- AddForeignKey
ALTER TABLE "_ChatSessionToUser" ADD CONSTRAINT "_ChatSessionToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChatSessionToUser" ADD CONSTRAINT "_ChatSessionToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
