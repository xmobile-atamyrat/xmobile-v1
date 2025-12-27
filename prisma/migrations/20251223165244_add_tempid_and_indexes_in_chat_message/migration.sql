/*
  Warnings:

  - A unique constraint covering the columns `[tempId]` on the table `ChatMessage` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "tempId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_tempId_key" ON "ChatMessage"("tempId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_isRead_idx" ON "ChatMessage"("sessionId", "isRead");

-- CreateIndex
CREATE INDEX "ChatMessage_tempId_idx" ON "ChatMessage"("tempId");
