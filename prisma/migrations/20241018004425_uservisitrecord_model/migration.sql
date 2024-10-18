-- CreateTable
CREATE TABLE "UserVisitRecord" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVisitRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserVisitRecord_createdAt_idx" ON "UserVisitRecord"("createdAt");
