-- CreateTable
CREATE TABLE "FCMToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "lastFailedAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FCMToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FCMToken_token_key" ON "FCMToken"("token");

-- CreateIndex
CREATE INDEX "FCMToken_userId_idx" ON "FCMToken"("userId");

-- CreateIndex
CREATE INDEX "FCMToken_userId_isActive_idx" ON "FCMToken"("userId", "isActive");

-- CreateIndex
CREATE INDEX "FCMToken_lastUsedAt_idx" ON "FCMToken"("lastUsedAt");

-- AddForeignKey
ALTER TABLE "FCMToken" ADD CONSTRAINT "FCMToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
